"use client";

import { type ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
  sidebar?: ReactNode;
  supplemental?: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function PageShell({
  children,
  sidebar,
  supplemental,
  title,
  subtitle,
}: PageShellProps) {
  return (
    <div className="content-grid pt-28 pb-10">
      {(title || subtitle) && (
        <header className="mb-8">
          {title && (
            <h1
              className="text-3xl md:text-4xl font-bold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-2 text-lg text-muted-foreground">{subtitle}</p>
          )}
        </header>
      )}

      {sidebar ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <main className="lg:col-span-9">{children}</main>
          <aside className="lg:col-span-3 sticky top-24 self-start">
            {sidebar}
          </aside>
        </div>
      ) : (
        <main>{children}</main>
      )}

      {supplemental && (
        <section className="mt-12 pt-8 border-t border-black/[0.06]">
          {supplemental}
        </section>
      )}
    </div>
  );
}
