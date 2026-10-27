import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { industries } from "@/lib/public/industries";
import { PortalSearch } from "@/components/public/portal-search";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

// Íconos de línea para los pasos y las ventajas (trazo 1.8, 24 × 24).
const icons = {
  doc: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  factory: <path d="M3 21V10l5 3V10l5 3V5h4v16zM7 17h2M11 17h2M15 17h2" />,
  compare: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 11v6M13 13v4M16 15v2" />,
  hands: <path d="M2 12l4-4 4 2 3-2 3 1 6 3M6 8l-2 9 3 2M9 13l3 3M11 11l4 4M14 10l3 3" />,
  shield: <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6zM8.5 12l2.5 2.5L16 10" />,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
};
const Icon = ({ name }: { name: keyof typeof icons }) => (
  <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-7">
    {icons[name]}
  </svg>
);

// Portada pública: portal de descubrimiento. Explorar no requiere cuenta; "Solicitar cotización"
// lleva al formulario de solicitud de acceso que ya existe.
export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Portal");
  const steps = t.raw("how.steps") as { title: string; body: string }[];
  const perks = t.raw("how.perks") as string[];
  const partner = t.raw("partner.items") as { title: string; body: string }[];
  const faq = t.raw("faq.items") as { q: string; a: string }[];
  const eyebrow = "font-display text-xs font-semibold tracking-[0.18em] text-gold-700 uppercase";
  const h2 = "font-display text-3xl font-bold text-balance text-navy-800 sm:text-4xl";
  const stepStyles = ["bg-navy-800 text-white", "bg-navy-100 text-navy-800", "bg-navy-100 text-navy-800", "bg-gold-500 text-white"];
  const stepIcons = ["doc", "factory", "compare", "hands"] as const;
  const partnerIcons = ["factory", "compare", "hands", "bolt"] as const;
  const cards = [
    ...industries.filter((i) => i.featured).map((i) => ({ href: `/industrias/${i.slug}`, photo: i.photo!, name: t(`industries.${i.slug}.name`), card: t(`industries.${i.slug}.card`) })),
    { href: "/solicitar-acceso", photo: "/fotos/otras.jpg", name: t("otherIndustries.name"), card: t("otherIndustries.card") },
  ];

  return (
    <>
      <PublicHeader />
      <main className="flex-1">
        {/* Hero con foto y buscador */}
        <section id="inicio" className="relative scroll-mt-20 bg-surface-muted">
          <div className="relative overflow-hidden bg-gradient-to-b from-[#fbf7ee] to-surface-muted">
            <div className="absolute inset-y-0 right-0 hidden w-[56%] md:block">
              <Image src="/fotos/puerto.jpg" alt="" fill priority sizes="56vw" className="object-cover object-left" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#fbf7ee] via-[#fbf7ee]/40 to-transparent" />
            </div>
            <div className="relative mx-auto grid max-w-6xl gap-6 px-4 pt-12 pb-8 sm:px-6 md:pt-16 md:pb-40">
              <p className={eyebrow}>{t("hero.eyebrow")}</p>
              <h1 className="max-w-[19ch] font-display text-4xl leading-[1.08] font-bold text-balance text-navy-800 sm:text-5xl lg:text-[3.4rem]">
                {t("hero.titleStart")}
                {t("hero.titleAccent")}
              </h1>
              <p className="max-w-md text-lg text-ink">{t("hero.subtitle")}</p>
              <div className="flex flex-wrap gap-3">
                <Link href="/solicitar-acceso" className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-control) bg-gold-500 px-6 font-display font-semibold text-navy-900 hover:bg-gold-300">
                  {t("hero.primary")} <span aria-hidden>→</span>
                </Link>
                <Link
                  href="/#como-funciona"
                  className="inline-flex min-h-12 items-center gap-2 rounded-(--radius-control) border border-navy-800 bg-surface px-6 font-display font-semibold text-navy-800 hover:bg-navy-50"
                >
                  <span aria-hidden className="grid size-5 place-items-center rounded-full bg-navy-800 text-[0.55rem] text-white">▶</span>
                  {t("hero.secondary")}
                </Link>
              </div>
            </div>
            <div className="relative aspect-[16/9] md:hidden">
              <Image src="/fotos/puerto.jpg" alt="" fill sizes="100vw" className="object-cover" />
            </div>
          </div>
          <div className="relative mx-auto -mt-14 max-w-5xl px-4 pb-12 sm:px-6 md:-mt-24">
            <PortalSearch />
          </div>
        </section>

        {/* Industrias */}
        <section id="industrias" className="scroll-mt-20 bg-surface py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
              <div className="grid gap-2">
                <p className={eyebrow}>{t("industriesSection.eyebrow")}</p>
                <h2 className={h2}>{t("industriesSection.title")}</h2>
              </div>
              <Link href="/industrias" className="font-display text-sm font-semibold text-navy-800 hover:underline">
                {t("industriesSection.all")} →
              </Link>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {cards.map((c) => (
                <li key={c.href + c.name}>
                  <Link
                    href={c.href}
                    className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(18,38,70,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="relative aspect-[4/3]">
                      <Image src={c.photo} alt="" fill sizes="(min-width:1024px) 16vw, (min-width:640px) 33vw, 50vw" className="object-cover" />
                    </span>
                    <span className="grid flex-1 content-start gap-1.5 p-3.5">
                      <span className="font-display font-semibold leading-snug text-navy-800">{c.name}</span>
                      <span className="text-xs text-ink-muted">{c.card}</span>
                      <span aria-hidden className="mt-auto pt-1 text-navy-800">→</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="scroll-mt-20 bg-surface-muted py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-10 grid gap-3">
              <p className={eyebrow}>{t("how.eyebrow")}</p>
              <h2 className={h2}>{t("how.title")}</h2>
              <ul className="mt-1 flex flex-wrap gap-2.5">
                {perks.map((p) => (
                  <li key={p} className="inline-flex items-center gap-2 rounded-full bg-gold-100 px-3.5 py-2 font-display text-sm font-semibold text-navy-800">
                    <span aria-hidden className="text-gold-700">✓</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((s, i) => (
                <li key={s.title} className="relative grid justify-items-center gap-2 text-center">
                  <span className={`mb-2 grid size-16 place-items-center rounded-full ${stepStyles[i]}`}>
                    <Icon name={stepIcons[i]} />
                  </span>
                  {i < steps.length - 1 ? (
                    <span aria-hidden className="absolute top-5 -right-6 hidden text-2xl text-navy-100 lg:block">→</span>
                  ) : null}
                  <span className="font-display text-lg font-semibold text-navy-800">
                    {i + 1}. {s.title}
                  </span>
                  <span className="max-w-[28ch] text-sm text-ink-muted">{s.body}</span>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <Link
                href="/solicitar-acceso"
                className="inline-flex min-h-12 items-center rounded-(--radius-control) bg-navy-800 px-6 font-display font-semibold text-white hover:bg-navy-900"
              >
                {t("how.cta")}
              </Link>
            </div>
          </div>
        </section>

        {/* Socio en abastecimiento (¿qué es Meridia?) */}
        <section id="sobre" className="scroll-mt-20 bg-surface">
          <div className="grid md:grid-cols-[46%_1fr]">
            <div className="relative aspect-[3/2] md:aspect-auto md:min-h-[440px]">
              <Image src="/fotos/equipo.jpg" alt="" fill sizes="(min-width:768px) 46vw, 100vw" className="object-cover md:rounded-r-2xl" />
            </div>
            <div className="grid content-center gap-4 px-4 py-14 sm:px-6 md:px-12 lg:px-16">
              <p className={eyebrow}>{t("partner.eyebrow")}</p>
              <h2 className={h2}>{t("partner.title")}</h2>
              <p className="max-w-xl text-ink-muted">{t("about.body")}</p>
              <ul className="mt-3 grid gap-6 sm:grid-cols-2">
                {partner.map((p, i) => (
                  <li key={p.title} className="grid grid-cols-[48px_1fr] items-start gap-3">
                    <span className="grid size-12 place-items-center rounded-full bg-navy-50 text-navy-800 [&_svg]:size-6">
                      <Icon name={partnerIcons[i]} />
                    </span>
                    <span>
                      <span className="block font-display font-semibold text-navy-800">{p.title}</span>
                      <span className="block text-sm text-ink-muted">{p.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Llamado final */}
        <section className="bg-navy-800 text-white">
          <div className="mx-auto grid max-w-6xl justify-items-start gap-5 px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="max-w-[22ch] font-display text-3xl font-bold text-balance sm:text-4xl">{t("final.title")}</h2>
            <p className="max-w-2xl text-navy-100">{t("final.body")}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/solicitar-acceso" className="inline-flex min-h-12 items-center rounded-(--radius-control) bg-gold-500 px-6 font-display font-semibold text-navy-900 hover:bg-gold-300">
                {t("final.primary")}
              </Link>
              <Link href="/#industrias" className="inline-flex min-h-12 items-center rounded-(--radius-control) border border-white px-6 font-display font-semibold text-white hover:bg-white/10">
                {t("final.secondary")}
              </Link>
            </div>
          </div>
        </section>

        {/* Preguntas frecuentes, plegadas al final */}
        <section id="preguntas" className="scroll-mt-20 border-t border-line bg-surface-muted py-5">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-baseline gap-3 py-2.5 font-display text-xl font-bold text-navy-800 [&::-webkit-details-marker]:hidden">
                {t("faq.title")}
                <span className="text-sm font-normal text-ink-muted group-open:hidden">{t("faq.hint")}</span>
                <span aria-hidden className="ml-auto text-2xl text-gold-700 group-open:hidden">+</span>
                <span aria-hidden className="ml-auto hidden text-2xl text-gold-700 group-open:inline">–</span>
              </summary>
              <div className="grid max-w-3xl gap-2.5 pt-2 pb-5">
                {faq.map((item) => (
                  <details key={item.q} className="group/q rounded-xl border border-line bg-surface">
                    <summary className="flex cursor-pointer list-none justify-between gap-3 px-4 py-4 font-display font-semibold text-navy-800 [&::-webkit-details-marker]:hidden">
                      {item.q}
                      <span aria-hidden className="text-xl leading-none text-gold-700 group-open/q:rotate-45">+</span>
                    </summary>
                    <p className="px-4 pb-4 text-ink-muted">{item.a}</p>
                  </details>
                ))}
              </div>
            </details>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
