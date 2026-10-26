import Image from "next/image";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ButtonLink } from "@/components/button-link";
import { SiteHeader } from "@/components/site-header";

const features = ["validated", "compare", "messaging"] as const;

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations("Home");
  const common = useTranslations("Common");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-20">
            <div>
              <p className="font-display text-sm font-semibold tracking-widest text-gold-700 uppercase">
                {t("eyebrow")}
              </p>
              <h1 className="mt-3 font-display text-3xl leading-tight font-bold text-navy-800 sm:text-5xl">
                {t("title")}
              </h1>
              <p className="mt-5 max-w-xl text-lg text-ink-muted">{t("subtitle")}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/ingresar">{common("signIn")}</ButtonLink>
                <ButtonLink href="/crear-cuenta" variant="accent">
                  {common("signUp")}
                </ButtonLink>
              </div>
            </div>
            <div className="mx-auto w-56 sm:w-72 md:w-full md:max-w-sm">
              <Image
                src="/brand/meridia-logo.png"
                alt="Meridia Trade Hub"
                width={796}
                height={702}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-surface-muted">
          <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 md:grid-cols-3">
            {features.map((key) => (
              <li key={key} className="rounded-xl border border-line bg-surface p-6">
                <span aria-hidden className="block h-1 w-10 rounded-full bg-gold-500" />
                <h2 className="mt-4 font-display text-lg font-semibold text-navy-800">
                  {t(`features.${key}.title`)}
                </h2>
                <p className="mt-2 text-ink-muted">{t(`features.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className="bg-navy-800 text-navy-100">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm sm:px-6">
          {t("footer")}
        </div>
      </footer>
    </>
  );
}
