import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { industries, industryBySlug } from "@/lib/public/industries";
import { Illustration } from "@/components/public/illustration";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export function generateStaticParams() {
  return industries.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/industrias/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const ind = industryBySlug(slug);
  if (!ind) return {};
  const t = await getTranslations({ locale, namespace: "Portal.industries" });
  return { title: `${t(`${ind.slug}.name`)} · Meridia Trade Hub`, description: t(`${ind.slug}.description`) };
}

// Página de una industria: descripción, subcategorías, ejemplos y aplicaciones. Sin precios ni fábricas.
export default async function IndustryPage({ params }: PageProps<"/[locale]/industrias/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const ind = industryBySlug(slug);
  if (!ind) notFound();
  const t = await getTranslations("Portal");
  const list = (key: "sub" | "products" | "applications") => t.raw(`industries.${ind.slug}.${key}`) as string[];
  const block = (title: string, items: string[]) => (
    <div>
      <h2 className="mb-2 font-display text-xs font-semibold tracking-[0.1em] text-gold-700 uppercase">{title}</h2>
      <ul className="grid list-disc gap-1 pl-5 text-ink-muted">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <PublicHeader />
      <main className="flex-1 bg-surface-muted">
        {ind.photo ? (
          <div className="relative aspect-[21/6] min-h-40">
            <Image src={ind.photo} alt="" fill priority sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-navy-950/35" />
          </div>
        ) : (
          <Illustration name={ind.icon} className="aspect-[21/6] min-h-40" />
        )}
        <div className="mx-auto -mt-10 grid max-w-4xl gap-6 px-4 pb-16 sm:px-6">
          <article className="grid gap-6 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
            <Link href="/industrias" className="text-sm font-semibold text-navy-800 hover:underline">
              {t("industryPage.back")}
            </Link>
            <div className="grid gap-2">
              <h1 className="font-display text-3xl font-bold text-balance text-navy-800 sm:text-4xl">{t(`industries.${ind.slug}.name`)}</h1>
              <p className="max-w-2xl text-lg text-ink-muted">{t(`industries.${ind.slug}.description`)}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {block(t("industryPage.sub"), list("sub"))}
              {block(t("industryPage.products"), list("products"))}
              {block(t("industryPage.applications"), list("applications"))}
              <div>
                <h2 className="mb-2 font-display text-xs font-semibold tracking-[0.1em] text-gold-700 uppercase">{t("industryPage.howTitle")}</h2>
                <p className="text-ink-muted">{t(ind.categories.length ? "industryPage.howBody" : "industryPage.howBodyNew")}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <Link href="/solicitar-acceso" className="text-sm font-semibold text-navy-800 underline-offset-4 hover:underline">
                {t("industryPage.other")}
              </Link>
              <Link
                href={`/solicitar-acceso?industria=${ind.slug}`}
                className="inline-flex min-h-12 items-center rounded-(--radius-control) bg-gold-500 px-6 font-display font-semibold text-navy-900 hover:bg-gold-300"
              >
                {t("industryPage.quote")}
              </Link>
            </div>
          </article>
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
