import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <button
        className="inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink transition hover:border-spruce hover:text-spruce"
        type="submit"
      >
        <LogOut aria-hidden="true" size={16} />
        Sign out
      </button>
    </form>
  );
}
