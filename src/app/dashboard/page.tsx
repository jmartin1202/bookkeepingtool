import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, CheckCircle2, FileText, Users } from "lucide-react";
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

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "No end date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function DashboardPage() {
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

  const { data: rawSubscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("organization_id", profile.organization_id)
    .maybeSingle();

  const subscription = rawSubscription as SubscriptionRow | null;

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-moss">
              {profile.organizations?.name ?? "Workspace"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-ink md:text-5xl">
              Welcome{profile.full_name ? `, ${profile.full_name}` : ""}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/65">
              Your auth foundation is ready. Next we will add clients,
              checklist templates, and the form that creates a real collection
              link.
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-moss/10 text-moss">
              <CheckCircle2 aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              Account active
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Signed in as {user.email}. Role: {profile.role}.
            </p>
          </article>

          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold/15 text-gold">
              <CalendarClock aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              Trial workspace
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              Status: {subscription?.status ?? "not configured"}. Ends:{" "}
              {formatDate(subscription?.current_period_end ?? null)}.
            </p>
          </article>

          <article className="rounded-md border border-line bg-white p-5 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-coral/10 text-coral">
              <FileText aria-hidden="true" size={20} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">
              Portal route ready
            </h2>
            <p className="mt-2 text-sm leading-6 text-ink/65">
              `/portal/[token]` is already built for client uploads.
            </p>
          </article>
        </section>

        <section className="mt-6 rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-ink">
                Next MVP workflow
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Add client management and checklist creation, then connect them
                to the existing collection-cycle API.
              </p>
            </div>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-md bg-spruce px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink"
              href="/portal/demo-token"
            >
              <Users aria-hidden="true" size={18} />
              Preview portal route
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
