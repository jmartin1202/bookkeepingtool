import { notFound } from "next/navigation";
import { Building2, CalendarDays } from "lucide-react";
import { PortalUploadList } from "@/app/components/portal-upload-list";
import { getPortalCycle } from "@/lib/public-upload/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

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

export default async function PublicPortalPage({ params }: PageProps) {
  const { token } = await params;
  const cycle = await getPortalCycle(token);

  if (!cycle || cycle.status !== "open") {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-md border border-line bg-white p-5 shadow-soft md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-moss">
                {cycle.organizationName}
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink md:text-5xl">
                {formatMonth(cycle.periodMonth)} documents
              </h1>
            </div>
            <div className="grid gap-3 text-sm text-ink/70 sm:grid-cols-2 md:min-w-80 md:grid-cols-1">
              <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2">
                <Building2 aria-hidden="true" size={18} className="text-moss" />
                <span className="min-w-0 truncate">{cycle.clientName}</span>
              </div>
              <div className="flex items-center gap-3 rounded-md bg-paper px-3 py-2">
                <CalendarDays aria-hidden="true" size={18} className="text-moss" />
                <span>Due {formatDate(cycle.dueDate)}</span>
              </div>
            </div>
          </div>
        </header>

        <PortalUploadList cycle={cycle} />
      </div>
    </main>
  );
}
