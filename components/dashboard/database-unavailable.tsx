import Link from "next/link";
import { AlertTriangle, Database, RefreshCw } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { SupabaseErrorStatus } from "@/lib/supabase/config";

export function DatabaseUnavailable({ status }: { status: SupabaseErrorStatus }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--canvas)] px-4 py-12">
      <section
        aria-labelledby="database-status-title"
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/5"
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-4">
          <span className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Kinfolio status</p>
            <p className="text-sm font-semibold text-[var(--ink)]">Dashboard is online</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <Database aria-hidden="true" className="mb-5 size-9 text-[var(--accent)]" />
          <h1 id="database-status-title" className="font-display text-3xl font-semibold tracking-tight text-[var(--ink)] sm:text-4xl">
            {status.title}
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)] sm:text-base">
            {status.message}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="/dashboard" className={buttonVariants({ variant: "primary" })}>
              <RefreshCw aria-hidden="true" className="size-4" />
              Try again
            </a>
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Return home
            </Link>
          </div>

          <p className="mt-6 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--muted)]">
            No market prices or portfolio values are fabricated while the database is unavailable.
          </p>
        </div>
      </section>
    </main>
  );
}
