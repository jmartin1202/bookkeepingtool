import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { signInAction } from "@/app/auth/actions";
import { AuthMessage } from "@/app/components/auth/auth-message";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: PageProps) {
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
      <section className="w-full max-w-md rounded-md border border-line bg-white p-6 shadow-soft">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-spruce text-white">
          <LockKeyhole aria-hidden="true" size={21} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-ink">Sign in</h1>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          Access your bookkeeping document collection dashboard.
        </p>

        <div className="mt-5">
          <AuthMessage error={params?.error} message={params?.message} />
        </div>

        <form action={signInAction} className="mt-6 space-y-4">
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
              autoComplete="current-password"
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
            Sign in
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink/65">
          New here?{" "}
          <Link className="font-semibold text-spruce hover:text-ink" href="/signup">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
