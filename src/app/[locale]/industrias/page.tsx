import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { industries } from "@/lib/public/industries";
import { Illustration } from "@/components/public/illustration";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export async function generateMetadata({ params }: PageProps<"/[locale]/industrias">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Portal.industryPage" });
  return { title: `${t("allTitle")} · Meridia Trade Hub` };
}

// Todas las industrias del portal, incluidas las que no aparecen en la portada.
export default async function IndustriesPage({ params }: PageProps<"/[locale]/industrias">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Portal");
  return (
    <>
      <PublicHeader />
      <main className="flex-1 bg-surface-muted py-12 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:px-6">
          <h1 className="font-display text-3xl font-bold text-navy-800 sm:text-4xl">{t("industryPage.allTitle")}</h1>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((ind) => (
              <li key={ind.slug}>
                <Link href={`/industrias/${ind.slug}`} className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface hover:shadow-[0_14px_30px_rgba(18,38,70,0.12)]">
                  {ind.photo ? (
                    <span className="relative aspect-[16/9]">
                      <Image src={ind.photo} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                    </span>
                  ) : (
                    <Illustration name={ind.icon} className="aspect-[16/9]" />
                  )}
                  <span className="grid gap-1.5 p-5">
                    <span className="font-display text-lg font-semibold text-navy-800">{t(`industries.${ind.slug}.name`)}</span>
                    <span className="text-sm text-ink-muted">{t(`industries.${ind.slug}.description`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/solicitar-acceso" className="font-display font-semibold text-navy-800 hover:underline">
            {t("industryPage.other")}
          </Link>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
