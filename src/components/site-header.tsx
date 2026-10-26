import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function SiteHeader() {
  const t = await getTranslations("Common");

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/brand/meridia-mark.png" alt="" width={40} height={33} priority />
          <span className="font-display text-lg leading-none font-bold tracking-wide text-navy-700">
            MERIDIA
            <span className="block text-[0.6rem] font-semibold tracking-[0.3em] text-gold-600">
              TRADE HUB
            </span>
          </span>
        </Link>
        <Link
          href="/ingresar"
          className="font-display text-sm font-semibold text-navy-800 hover:text-gold-700"
        >
          {t("signIn")}
        </Link>
      </div>
    </header>
  );
}
