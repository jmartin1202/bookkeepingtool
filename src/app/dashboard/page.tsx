import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  PlusCircle,
  Users,
} from "lucide-react";
import {
  createChecklistTemplateAction,
  createClientAction,
  createCollectionCycleAction,
} from "@/app/dashboard/actions";
import { CopyUploadLinkButton } from "@/app/components/dashboard/copy-upload-link-button";
import { LogoutButton } from "@/app/components/dashboard/logout-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: "owner" | "staff";
  organization_id: string;
  organizations: { name: string } | null;
};

type SubscriptionRow = {
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
  current_period_end: string | null;
};

type ClientRow = {
  id: string;
  name: string;
  contact_email: string;
  status: "active" | "archived";
};

type TemplateRow = {
  id: string;
  name: string;
  checklist_items: { id: string; label: string }[] | null;
};

type RelatedName = { name: string } | { name: string }[] | null;

type CycleRow = {
  id: string;
  public_token: string;
  period_month: string;
  due_date: string;
  status: "open" | "complete" | "archived";
  created_at: string;
  clients: RelatedName;
  checklist_templates: RelatedName;
  document_requests: { status: string }[] | null;
};

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "No end date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function dateInputValue(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultDueDateValue() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return dateInputValue(dueDate);
}

function StatusMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;

  return (
    <div
      className={
        error
          ? "rounded-md border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-medium text-coral"
          : "rounded-md border border-moss/25 bg-moss/10 px-4 py-3 text-sm font-medium text-moss"
      }
    >
      {error ?? success}
    </div>
  );
}

function relatedName(value: RelatedName, fallback: string) {
  if (Array.isArray(value)) {
    return value[0]?.name ?? fallback;
  }

  return value?.name ?? fallback;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();

  const profile = rawProfile as ProfileRow | null;

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <section className="max-w-lg rounded-md border border-line bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-semibold text-ink">
            Workspace setup is still pending
          </h1>
          <p className="mt-3 text-sm leading-6 text-ink/65">
            Your account exists, but the organization/profile row is missing.
            Apply `supabase/002_auth_bootstrap.sql`, then create a new account
            or add the profile manually for this user.
          </p>
          <div className="mt-5">
            <LogoutButton />
          </div>
        </section>
      </main>
    );
  }

  const [
    { data: rawSubscription },
    { data: rawClients },
    { data: rawTemplates },
    { data: rawCycles },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("organization_id", profile.organization_id)
      .maybeSingle(),
    supabase
      .from("clients")
      .select("id, name, contact_email, status")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    supabase
      .from("checklist_templates")
      .select("id, name, checklist_items(id, label)")
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("collection_cycles")
      .select(
        `
          id,
          public_token,
          period_month,
          due_date,
          status,
          created_at,
          clients(name),
          checklist_templates(name),
          document_requests(status)
        `,
      )
      .eq("organization_id", profile.organization_id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const subscription = rawSubscription as SubscriptionRow | null;
  const clients = (rawClients ?? []) as ClientRow[];
  const templates = (rawTemplates ?? []) as TemplateRow[];
  const cycles = (rawCycles ?? []) as unknown as CycleRow[];
  const params = await searchParams;
  const canCreateCycle = clients.length > 0 && templates.length > 0;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-moss">
              {profile.organizations?.name ?? "Workspace"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink md:text-5xl">
              Month-end collections
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
              Add a client, save a reusable checklist, then create one secure
              upload link for the month.
            </p>
          </div>
          <LogoutButton />
        </header>

        <div className="mt-6">
          <StatusMessage error={params?.error} success={params?.success} />
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-moss/10 text-moss">
              <Users aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              {clients.length} active clients
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Signed in as {user.email}. Role: {profile.role}.
            </p>
          </article>

          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-gold">
              <ClipboardList aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              {templates.length} checklist templates
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Keep standard month-end requirements reusable.
            </p>
          </article>

          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-coral/10 text-coral">
              <CalendarClock aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              {subscription?.status ?? "not configured"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Trial/billing period ends {formatDate(subscription?.current_period_end ?? null)}.
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <form
            action={createClientAction}
            className="rounded-md border border-line bg-white p-5 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <PlusCircle aria-hidden="true" className="text-moss" size={20} />
              <h2 className="text-xl font-semibold text-ink">Add client</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-ink">
                Client name
                <input
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  name="name"
                  placeholder="Acme Plumbing"
                  required
                  type="text"
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Contact email
                <input
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  name="contactEmail"
                  placeholder="owner@example.com"
                  required
                  type="email"
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Phone
                <input
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  name="contactPhone"
                  placeholder="Optional"
                  type="tel"
                />
              </label>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-spruce px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink"
                type="submit"
              >
                Save client
              </button>
            </div>
          </form>

          <form
            action={createChecklistTemplateAction}
            className="rounded-md border border-line bg-white p-5 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <ClipboardList aria-hidden="true" className="text-moss" size={20} />
              <h2 className="text-xl font-semibold text-ink">Create checklist</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-ink">
                Template name
                <input
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  name="name"
                  placeholder="Standard month-end close"
                  required
                  type="text"
                />
              </label>
              <label className="block text-sm font-semibold text-ink">
                Checklist items
                <textarea
                  className="mt-2 min-h-40 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal leading-6 text-ink"
                  defaultValue={[
                    "Bank statements",
                    "Credit card statements",
                    "Payroll report",
                    "Loan statements",
                    "Large receipts",
                  ].join("\n")}
                  name="items"
                  required
                />
              </label>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-spruce px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink"
                type="submit"
              >
                Save checklist
              </button>
            </div>
          </form>

          <form
            action={createCollectionCycleAction}
            className="rounded-md border border-line bg-white p-5 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <FileText aria-hidden="true" className="text-moss" size={20} />
              <h2 className="text-xl font-semibold text-ink">Create link</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-semibold text-ink">
                Client
                <select
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  disabled={clients.length === 0}
                  name="clientId"
                  required
                >
                  <option value="">Choose a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-ink">
                Checklist
                <select
                  className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                  disabled={templates.length === 0}
                  name="templateId"
                  required
                >
                  <option value="">Choose a checklist</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.checklist_items?.length ?? 0})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-ink">
                  Month
                  <input
                    className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                    defaultValue={currentMonthValue()}
                    name="periodMonth"
                    required
                    type="date"
                  />
                </label>
                <label className="block text-sm font-semibold text-ink">
                  Due date
                  <input
                    className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
                    defaultValue={defaultDueDateValue()}
                    name="dueDate"
                    required
                    type="date"
                  />
                </label>
              </div>
              <button
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-spruce px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/35"
                disabled={!canCreateCycle}
                type="submit"
              >
                Generate upload link
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6 rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                Recent collection links
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Send these links to clients when you are ready to collect their
                month-end documents.
              </p>
            </div>
            <CheckCircle2 aria-hidden="true" className="hidden text-moss md:block" />
          </div>

          {cycles.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-line bg-paper p-6 text-sm leading-6 text-ink/65">
              No collection links yet. Add one client and one checklist, then
              generate your first upload link.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-ink/60">
                    <th className="py-3 pr-4 font-semibold">Client</th>
                    <th className="py-3 pr-4 font-semibold">Month</th>
                    <th className="py-3 pr-4 font-semibold">Checklist</th>
                    <th className="py-3 pr-4 font-semibold">Received</th>
                    <th className="py-3 pr-4 font-semibold">Due</th>
                    <th className="py-3 pr-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((cycle) => {
                    const requests = cycle.document_requests ?? [];
                    const received = requests.filter(
                      (request) =>
                        request.status === "uploaded" ||
                        request.status === "approved",
                    ).length;
                    const portalPath = `/portal/${cycle.public_token}`;

                    return (
                      <tr className="border-b border-line last:border-0" key={cycle.id}>
                        <td className="py-4 pr-4 font-semibold text-ink">
                          {relatedName(cycle.clients, "Client")}
                        </td>
                        <td className="py-4 pr-4 text-ink/70">
                          {formatMonth(cycle.period_month)}
                        </td>
                        <td className="py-4 pr-4 text-ink/70">
                          {relatedName(cycle.checklist_templates, "Checklist")}
                        </td>
                        <td className="py-4 pr-4 text-ink/70">
                          {received} of {requests.length}
                        </td>
                        <td className="py-4 pr-4 text-ink/70">
                          {formatDate(cycle.due_date)}
                        </td>
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <Link
                              className="inline-flex items-center justify-center rounded-md bg-spruce px-3 py-2 text-sm font-semibold text-white transition hover:bg-ink"
                              href={portalPath}
                            >
                              Open
                            </Link>
                            <CopyUploadLinkButton path={portalPath} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
