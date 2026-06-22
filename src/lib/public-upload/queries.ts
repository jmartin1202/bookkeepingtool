import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PortalCycle, PortalDocumentRequest } from "./types";

type CycleRow = {
  id: string;
  public_token: string;
  period_month: string;
  due_date: string;
  status: "open" | "complete" | "archived";
  clients: { name: string; contact_email: string } | null;
  organizations: { name: string } | null;
};

type RequestRow = {
  id: string;
  label: string;
  description: string | null;
  required: boolean;
  status: "missing" | "uploaded" | "approved" | "rejected";
  document_uploads:
    | {
        id: string;
        original_filename: string;
        created_at: string;
      }[]
    | null;
};

export async function getPortalCycle(
  publicToken: string,
): Promise<PortalCycle | null> {
  const supabase = createSupabaseAdminClient();

  const { data: rawCycle, error: cycleError } = await supabase
    .from("collection_cycles")
    .select(
      `
        id,
        public_token,
        period_month,
        due_date,
        status,
        clients!inner(name, contact_email),
        organizations!inner(name)
      `,
    )
    .eq("public_token", publicToken)
    .neq("status", "archived")
    .single();

  const cycle = rawCycle as CycleRow | null;

  if (cycleError || !cycle) {
    return null;
  }

  const { data: requests, error: requestError } = await supabase
    .from("document_requests")
    .select(
      `
        id,
        label,
        description,
        required,
        status,
        document_uploads(id, original_filename, created_at)
      `,
    )
    .eq("cycle_id", cycle.id)
    .order("sort_order", { ascending: true })
    .returns<RequestRow[]>();

  if (requestError) {
    throw new Error(requestError.message);
  }

  const portalRequests: PortalDocumentRequest[] = (requests ?? []).map(
    (request) => ({
      id: request.id,
      label: request.label,
      description: request.description,
      required: request.required,
      status: request.status,
      uploads: (request.document_uploads ?? []).map((upload) => ({
        id: upload.id,
        originalFilename: upload.original_filename,
        createdAt: upload.created_at,
      })),
    }),
  );

  return {
    id: cycle.id,
    publicToken: cycle.public_token,
    periodMonth: cycle.period_month,
    dueDate: cycle.due_date,
    status: cycle.status,
    organizationName: cycle.organizations?.name ?? "Your bookkeeper",
    clientName: cycle.clients?.name ?? "Client",
    clientEmail: cycle.clients?.contact_email ?? "",
    requests: portalRequests,
  };
}
