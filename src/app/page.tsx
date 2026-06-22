import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase text-moss">
          Month-End Document Chaser
        </p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink md:text-6xl">
          Secure month-end document collection for bookkeeping teams.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-ink/70">
          Create a checklist, send one link, and collect every missing document
          in one organized client portal.
        </p>
        <Link
          href="/portal/demo-token"
          className="mt-8 inline-flex items-center gap-2 rounded-md bg-spruce px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-ink"
        >
          View portal route
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>
    </main>
  );
}
