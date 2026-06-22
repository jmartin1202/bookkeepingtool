import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const signUploadSchema = z.object({
  publicToken: z.string().min(32).max(96),
  documentRequestId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  fileType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

function sanitizeFileName(fileName: string) {
  const safeFileName = fileName
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

  return safeFileName || "upload";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signUploadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid upload request", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  if (!ACCEPTED_MIME_TYPES.has(parsed.data.fileType)) {
    return NextResponse.json(
      { error: "Unsupported file type" },
      { status: 415 },
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

  const safeFileName = sanitizeFileName(parsed.data.fileName);
  const storagePath = `${cycle.id}/${documentRequest.id}/${crypto.randomUUID()}-${safeFileName}`;

  // The signed URL lets a public client upload directly to a private bucket.
  const { data: signedUpload, error: signedUploadError } =
    await supabase.storage
      .from("client-documents")
      .createSignedUploadUrl(storagePath);

  if (signedUploadError || !signedUpload) {
    return NextResponse.json(
      { error: signedUploadError?.message ?? "Could not create upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bucket: "client-documents",
    path: signedUpload.path,
    token: signedUpload.token,
    signedUrl: signedUpload.signedUrl,
  });
}
