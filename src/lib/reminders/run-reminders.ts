import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendReminderEmail } from "@/lib/reminders/email";

type RelatedName = { name: string } | { name: string }[] | null;
type RelatedClient =
  | { id: string; name: string; contact_email: string }
  | { id: string; name: string; contact_email: string }[]
  | null;

type RequestRow = {
  id: string;
  label: string;
  status: "missing" | "uploaded" | "approved" | "rejected";
  last_reminded_at: string | null;
};

type CycleRow = {
  id: string;
  public_token: string;
  period_month: string;
  due_date: string;
  clients: RelatedClient;
  organizations: RelatedName;
  document_requests: RequestRow[] | null;
};

type ReminderResult = {
  scanned: number;
  sent: number;
  skipped: number;
  failed: number;
  details: {
    cycleId: string;
    clientName: string;
    status: "sent" | "skipped" | "failed";
    reason?: string;
    missingCount: number;
  }[];
};

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

function minReminderHours() {
  const value = Number(process.env.REMINDER_MIN_HOURS ?? "48");
  return Number.isFinite(value) && value > 0 ? value : 48;
}

function getRelatedName(value: RelatedName, fallback: string) {
  if (Array.isArray(value)) return value[0]?.name ?? fallback;
  return value?.name ?? fallback;
}

function getRelatedClient(value: RelatedClient) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function shouldRemind(request: RequestRow, cutoff: Date) {
  if (request.status !== "missing" && request.status !== "rejected") {
    return false;
  }

  if (!request.last_reminded_at) {
    return true;
  }

  return new Date(request.last_reminded_at) <= cutoff;
}

function todayDateString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function runReminderSweep(): Promise<ReminderResult> {
  const supabase = createSupabaseAdminClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - minReminderHours() * 60 * 60 * 1000);
  const result: ReminderResult = {
    scanned: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const { data, error } = await supabase
    .from("collection_cycles")
    .select(
      `
        id,
        public_token,
        period_month,
        due_date,
        clients(id, name, contact_email),
        organizations(name),
        document_requests(id, label, status, last_reminded_at)
      `,
    )
    .eq("status", "open")
    .lte("due_date", todayDateString())
    .order("due_date", { ascending: true })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const cycles = (data ?? []) as unknown as CycleRow[];
  result.scanned = cycles.length;

  for (const cycle of cycles) {
    const client = getRelatedClient(cycle.clients);
    const clientName = client?.name ?? "Client";
    const organizationName = getRelatedName(cycle.organizations, "Your bookkeeper");
    const dueRequests = (cycle.document_requests ?? []).filter((request) =>
      shouldRemind(request, cutoff),
    );

    if (!client?.contact_email) {
      result.skipped += 1;
      result.details.push({
        cycleId: cycle.id,
        clientName,
        status: "skipped",
        reason: "Client has no email address",
        missingCount: dueRequests.length,
      });
      continue;
    }

    if (dueRequests.length === 0) {
      result.skipped += 1;
      result.details.push({
        cycleId: cycle.id,
        clientName,
        status: "skipped",
        reason: "No missing items need a reminder yet",
        missingCount: 0,
      });
      continue;
    }

    try {
      const uploadUrl = new URL(`/portal/${cycle.public_token}`, appUrl()).toString();
      await sendReminderEmail({
        to: client.contact_email,
        clientName,
        organizationName,
        periodLabel: formatMonth(cycle.period_month),
        dueDateLabel: formatDate(cycle.due_date),
        uploadUrl,
        missingItems: dueRequests.map((request) => request.label),
      });

      const remindedIds = dueRequests.map((request) => request.id);

      const [{ error: updateError }, { error: logError }] = await Promise.all([
        supabase
          .from("document_requests")
          .update({ last_reminded_at: now.toISOString() })
          .in("id", remindedIds),
        supabase.from("reminder_logs").insert({
          cycle_id: cycle.id,
          client_id: client.id,
          channel: "email",
          status: "sent",
          error_message: null,
        }),
      ]);

      if (updateError || logError) {
        throw new Error(updateError?.message ?? logError?.message ?? "Reminder log failed");
      }

      result.sent += 1;
      result.details.push({
        cycleId: cycle.id,
        clientName,
        status: "sent",
        missingCount: dueRequests.length,
      });
    } catch (error) {
      result.failed += 1;

      await supabase.from("reminder_logs").insert({
        cycle_id: cycle.id,
        client_id: client.id,
        channel: "email",
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown reminder error",
      });

      result.details.push({
        cycleId: cycle.id,
        clientName,
        status: "failed",
        reason: error instanceof Error ? error.message : "Unknown reminder error",
        missingCount: dueRequests.length,
      });
    }
  }

  return result;
}
