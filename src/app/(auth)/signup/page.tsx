import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2 } from "lucide-react";
import { signUpAction } from "@/app/auth/actions";
import { AuthMessage } from "@/app/components/auth/auth-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: PageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-lg rounded-md border border-line bg-white p-6 shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-spruce text-white">
          <Building2 aria-hidden="true" size={21} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-ink">
          Create your firm workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Start with a 14-day trial workspace so you can create real collection
          links before billing is connected.
        </p>

        <div className="mt-5">
          <AuthMessage error={params?.error} />
        </div>

        <form action={signUpAction} className="mt-6 grid gap-4">
          <label className="block text-sm font-semibold text-ink">
            Your name
            <input
              autoComplete="name"
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
              name="fullName"
              required
              type="text"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Firm name
            <input
              autoComplete="organization"
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
              name="organizationName"
              required
              type="text"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Email
            <input
              autoComplete="email"
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
              name="email"
              required
              type="email"
            />
          </label>

          <label className="block text-sm font-semibold text-ink">
            Password
            <input
              autoComplete="new-password"
              className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-base font-normal text-ink"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-spruce px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink"
            type="submit"
          >
            Create workspace
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink/65">
          Already have an account?{" "}
          <Link className="font-semibold text-spruce hover:text-ink" href="/login">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
