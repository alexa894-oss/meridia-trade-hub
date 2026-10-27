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
    <div className="grid gap-4 rounded-2xl border border-line bg-surface p-4 shadow-[0_18px_45px_rgba(18,38,70,0.12)] sm:p-5">
      <form role="search" onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
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
          className="min-h-13 min-w-0 flex-1 rounded-(--radius-control) border border-line bg-surface bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%23122646%22%20stroke-width=%222.2%22%3E%3Ccircle%20cx=%2211%22%20cy=%2211%22%20r=%227%22/%3E%3Cpath%20d=%22m20%2020-4-4%22/%3E%3C/svg%3E')] bg-[length:22px] bg-[position:14px_center] bg-no-repeat pr-3 pl-12 text-[17px] text-navy-700 outline-none placeholder:text-navy-700 focus:border-navy-600"
        />
        <button type="submit" className="min-h-13 rounded-(--radius-control) bg-navy-800 px-7 font-display font-semibold text-white hover:bg-navy-900">
          {t("hero.searchButton")}
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-ink">{t("hero.try")}</span>
        {examples.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => run(ex)}
            className="rounded-full bg-surface-muted px-3.5 py-1.5 text-sm text-navy-800 hover:bg-gold-100"
          >
            {ex}
          </button>
        ))}
      </div>

      {searched ? (
        <div aria-live="polite" className="grid gap-3 border-t border-line pt-4 text-navy-700">
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
