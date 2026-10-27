"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

export type SectionNavItem = { href: string; key: string; exact?: boolean };

// Navegación de cada área (comprador, fábrica, administrador).
export function SectionNav({ items, namespace }: { items: SectionNavItem[]; namespace: string }) {
  const t = useTranslations(namespace);
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex gap-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${
                  active ? "bg-navy-800 text-white" : "bg-surface text-navy-800 hover:bg-navy-50"
                }`}
              >
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
