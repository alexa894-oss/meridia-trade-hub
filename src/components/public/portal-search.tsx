"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { industries, normalize } from "@/lib/public/industries";

const requestHref = (query: string, industry?: string) => {
  const params = new URLSearchParams();
  if (query) params.set("producto", query);
  if (industry) params.set("industria", industry);
  const qs = params.toString();
  return `/solicitar-acceso${qs ? `?${qs}` : ""}`;
};

// Buscador de la portada: busca en las industrias del portal (sin precios, fábricas ni disponibilidad).
export function PortalSearch() {
  const t = useTranslations("Portal");
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<string | null>(null);
  const examples = t.raw("hero.examples") as string[];

  const matches = (() => {
    if (!searched) return [];
    const words = normalize(searched).split(/\s+/).filter((w) => w.length > 2);
    return industries
      .map((ind) => {
        const hay = normalize(
          [t(`industries.${ind.slug}.name`), ...(t.raw(`industries.${ind.slug}.sub`) as string[]), ...(t.raw(`industries.${ind.slug}.products`) as string[]), ...ind.keywords].join(" "),
        );
        const score = words.reduce((s, w) => s + (hay.includes(w) || hay.includes(w.replace(/e?s$/, "")) ? 1 : 0), 0);
        return { ind, score };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score);
  })();

  function run(text: string) {
    setQuery(text);
    setSearched(text.trim() || null);
  }
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(query);
  }

  return (
    <div className="grid gap-4">
      <form role="search" onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-[0_12px_40px_rgba(0,0,0,0.25)] sm:flex-row">
        <label htmlFor="portal-q" className="sr-only">
          {t("hero.searchLabel")}
        </label>
        <input
          id="portal-q"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("hero.placeholder")}
          className="min-h-12 min-w-0 flex-1 bg-transparent px-3 text-[17px] text-navy-700 outline-none placeholder:text-navy-600/60"
        />
        <button type="submit" className="min-h-13 rounded-(--radius-control) bg-gold-500 px-6 font-display font-semibold text-navy-900 hover:bg-gold-300">
          {t("hero.searchButton")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-navy-100">{t("hero.try")}</span>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => run(ex)}
            className="rounded-full border border-white/30 bg-white/5 px-3 py-1.5 text-sm text-white hover:border-gold-500"
          >
            {ex}
          </button>
        ))}
      </div>

      {searched ? (
        <div aria-live="polite" className="grid max-w-3xl gap-3 rounded-2xl bg-white p-4 text-navy-700">
          {matches.length ? (
            <>
              <h2 className="font-display text-base font-semibold">{t("search.related")}</h2>
              <ul className="grid gap-2">
                {matches.map(({ ind }) => (
                  <li key={ind.slug}>
                    <Link
                      href={`/industrias/${ind.slug}`}
                      className="flex items-center justify-between gap-3 rounded-(--radius-control) border border-navy-100 bg-navy-50 px-3 py-2.5 hover:border-gold-500"
                    >
                      <span>
                        <span className="block font-semibold">{t(`industries.${ind.slug}.name`)}</span>
                        <span className="block text-sm text-navy-600">{t(`industries.${ind.slug}.description`)}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold">{t("search.see")}</span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div>
                <Link
                  href={requestHref(searched, matches[0].ind.slug)}
                  className="inline-flex min-h-11 items-center rounded-(--radius-control) bg-gold-500 px-5 font-display font-semibold text-navy-900 hover:bg-gold-300"
                >
                  {t("search.quoteFor", { query: searched })}
                </Link>
              </div>
            </>
          ) : (
            <div className="grid gap-2 rounded-(--radius-control) bg-gold-100 p-4">
              <p className="font-semibold">{t("search.noneTitle")}</p>
              <p className="text-sm text-navy-600">{t("search.noneBody", { query: searched })}</p>
              <div>
                <Link
                  href={requestHref(searched)}
                  className="inline-flex min-h-11 items-center rounded-(--radius-control) bg-navy-800 px-5 font-display font-semibold text-white hover:bg-navy-900"
                >
                  {t("search.noneButton")}
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
