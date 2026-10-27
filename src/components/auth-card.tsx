import type { ReactNode } from "react";
import { SiteHeader } from "@/components/site-header";

export function AuthCard({ title, subtitle, children, wide = false }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 justify-center bg-surface-muted px-4 py-10 sm:py-16">
        <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"}`}>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <h1 className="font-display text-2xl font-bold text-navy-800">{title}</h1>
            {subtitle ? <p className="mt-2 text-ink-muted">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
        </div>
      </main>
    </>
  );
}
