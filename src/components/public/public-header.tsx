"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// Cabecera fija del portal público: navegación y "Solicitar cotización". En celular, menú desplegable.
export function PublicHeader() {
  const t = useTranslations("Portal.nav");
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#inicio", label: t("home") },
    { href: "/#industrias", label: t("industries") },
    { href: "/#como-funciona", label: t("how") },
    { href: "/#sobre", label: t("about") },
    { href: "/#contacto", label: t("contact") },
  ];

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="relative mx-auto flex min-h-17 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <Image src="/brand/meridia-mark.png" alt="" width={40} height={33} priority className="h-[33px] w-auto" />
          <span className="font-display text-lg leading-none font-bold tracking-wide text-navy-700">
            MERIDIA
            <span className="block text-[0.6rem] font-semibold tracking-[0.3em] text-gold-600">TRADE HUB</span>
          </span>
        </Link>

        <nav aria-label={t("label")} className="ml-auto hidden items-center gap-6 xl:gap-7 lg:flex">
          {links.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b-2 py-2 font-display text-sm font-medium text-navy-800 hover:border-gold-500 ${i === 0 ? "border-gold-500" : "border-transparent"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/ingresar"
          className="hidden min-h-10 items-center rounded-(--radius-control) border border-navy-800 px-4 font-display text-sm font-semibold text-navy-800 hover:bg-navy-50 lg:inline-flex"
        >
          {t("signIn")}
        </Link>
        <Link
          href="/solicitar-acceso"
          className="hidden min-h-10 items-center rounded-(--radius-control) bg-gold-500 px-4 font-display text-sm font-semibold text-navy-900 hover:bg-gold-300 lg:inline-flex"
        >
          {t("quote")}
        </Link>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="menu-publico"
          aria-label={open ? t("closeMenu") : t("openMenu")}
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-grid size-10 place-items-center rounded-(--radius-control) border border-line text-navy-800 lg:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
        {open ? (
          <nav id="menu-publico" aria-label={t("label")} className="absolute inset-x-0 top-full grid gap-1 border-b border-line bg-surface px-4 pt-2 pb-4 sm:px-6 lg:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="py-2 font-display text-base font-medium text-navy-800">
                {l.label}
              </Link>
            ))}
            <Link href="/ingresar" onClick={() => setOpen(false)} className="py-2 font-display text-base font-medium text-navy-800">
              {t("signIn")}
            </Link>
            <Link
              href="/solicitar-acceso"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex min-h-11 items-center justify-center rounded-(--radius-control) bg-gold-500 px-4 font-display font-semibold text-navy-900"
            >
              {t("quote")}
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
