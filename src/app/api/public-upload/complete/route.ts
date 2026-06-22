import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const completeUploadSchema = z.object({
  publicToken: z.string().min(32).max(96),
  documentRequestId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(180),
  mimeType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  uploadedByEmail: z.string().email().max(254),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = completeUploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid completion request", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const supabase = createSupabaseAdminClient();

  const { data: cycle, error: cycleError } = await supabase
    .from("collection_cycles")
    .select("id, status")
    .eq("public_token", parsed.data.publicToken)
    .single();

  if (cycleError || !cycle || cycle.status !== "open") {
    return NextResponse.json(
      { error: "Upload portal is not available" },
      { status: 404 },
    );
  }

  const expectedPrefix = `${cycle.id}/${parsed.data.documentRequestId}/`;

  if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "Upload path does not match this request" },
      { status: 400 },
    );
  }

  const { data: documentRequest, error: requestError } = await supabase
    .from("document_requests")
    .select("id")
    .eq("id", parsed.data.documentRequestId)
    .eq("cycle_id", cycle.id)
    .single();

  if (requestError || !documentRequest) {
    return NextResponse.json(
      { error: "Document request not found" },
      { status: 404 },
    );
  }

  const objectName = parsed.data.storagePath.slice(expectedPrefix.length);
  const { data: storageObjects, error: storageError } = await supabase.storage
    .from("client-documents")
    .list(expectedPrefix.slice(0, -1), {
      limit: 1,
      search: objectName,
    });

  if (
    storageError ||
    !storageObjects?.some((storageObject) => storageObject.name === objectName)
  ) {
    return NextResponse.json(
      { error: "Uploaded file was not found in storage" },
      { status: 400 },
    );
  }

  const { error: insertError } = await supabase.from("document_uploads").insert({
    document_request_id: documentRequest.id,
    storage_path: parsed.data.storagePath,
    original_filename: parsed.data.originalFilename,
    mime_type: parsed.data.mimeType,
    file_size: parsed.data.fileSize,
    uploaded_by_email: parsed.data.uploadedByEmail.trim().toLowerCase(),
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("document_requests")
    .update({ status: "uploaded" })
    .eq("id", documentRequest.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    upload: {
      documentRequestId: documentRequest.id,
      storagePath: parsed.data.storagePath,
      originalFilename: parsed.data.originalFilename,
      status: "uploaded",
    },
  });
}
