"use client";

import { signOut, useSession } from "next-auth/react";

export function TopBar() {
  const { data: session } = useSession();

  if (!session?.user) {
    return null;
  }

  const isClient = session.user.role === "client";

  return (
    <header className="fixed left-[220px] right-0 top-0 z-10 flex h-16 items-center justify-end border-b border-border-subtle bg-bg-base/95 px-8 backdrop-blur">
      <div className="flex items-center gap-3">
        {session.user.image ? (
          <span
            aria-label={session.user.name ?? "User profile"}
            className="h-7 w-7 rounded-full border border-border-subtle bg-cover bg-center"
            style={{ backgroundImage: `url(${session.user.image})` }}
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border-subtle bg-bg-card font-mono text-[0.68rem] text-green-primary">
            {session.user.name?.charAt(0).toUpperCase() ?? "U"}
          </span>
        )}

        <span className="text-[0.82rem] text-grey-300">
          {session.user.name ?? session.user.email}
        </span>

        <span
          className={[
            "rounded-full border px-2.5 py-1 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.14em]",
            isClient
              ? "border-amber-warn/70 bg-amber-warn/10 text-amber-warn"
              : "border-green-dim bg-green-ghost text-green-primary",
          ].join(" ")}
        >
          {session.user.role}
        </span>

        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/login" })}
          className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-grey-500 transition-colors hover:text-green-primary"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
