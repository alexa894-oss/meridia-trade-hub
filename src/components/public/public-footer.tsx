import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function PublicFooter() {
  const t = await getTranslations("Portal.footer");
  const tn = await getTranslations("Portal.nav");
  const head = "mb-3 font-display text-xs font-semibold tracking-[0.12em] text-white uppercase";
  const link = "text-navy-100 hover:text-white";
  return (
    <footer id="contacto" className="scroll-mt-20 bg-navy-950 text-sm text-navy-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-11 place-items-center rounded-full bg-white">
              <Image src="/brand/meridia-mark.png" alt="" width={40} height={33} className="h-[26px] w-auto" />
            </span>
            <span className="font-display text-lg leading-none font-bold tracking-wide text-white">
              MERIDIA
              <span className="block text-[0.6rem] font-semibold tracking-[0.3em] text-gold-500">TRADE HUB</span>
            </span>
          </Link>
          <p className="max-w-xs">{t("description")}</p>
        </div>
        <div>
          <h2 className={head}>{t("explore")}</h2>
          <ul className="grid gap-2">
            <li><Link className={link} href="/#industrias">{tn("industries")}</Link></li>
            <li><Link className={link} href="/#como-funciona">{tn("how")}</Link></li>
            <li><Link className={link} href="/#preguntas">{t("faq")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className={head}>{t("meridia")}</h2>
          <ul className="grid gap-2">
            <li><Link className={link} href="/#sobre">{tn("about")}</Link></li>
            <li>
              {t("contact")}: <span className="text-white select-all">{t("contactEmail")}</span>
            </li>
            <li><Link className={link} href="/ingresar">{t("platform")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className={head}>{t("legal")}</h2>
          <ul className="grid gap-2">
            <li><Link className={link} href="/legal/terminos">{t("terms")}</Link></li>
            <li><Link className={link} href="/legal/privacidad">{t("privacy")}</Link></li>
            <li><Link className={link} href="/legal/no-elusion">{t("nonCircumvention")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-4 py-4 text-xs sm:px-6">{t("rights")}</div>
    </footer>
  );
}
