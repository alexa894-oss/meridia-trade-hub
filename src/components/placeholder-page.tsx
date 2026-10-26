import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/button-link";
import { SiteHeader } from "@/components/site-header";

// Pantalla temporal para rutas que se construyen en etapas siguientes.
export async function PlaceholderPage({ title }: { title: string }) {
  const t = await getTranslations("Common");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-navy-800">{title}</h1>
        <p className="mt-3 text-ink-muted">{t("comingSoon")}</p>
        <ButtonLink href="/" variant="outline" className="mt-8">
          {t("backHome")}
        </ButtonLink>
      </main>
    </>
  );
}
