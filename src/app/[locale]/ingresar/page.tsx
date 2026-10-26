import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function SignInPage({ params }: PageProps<"/[locale]/ingresar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SignIn");
  return <PlaceholderPage title={t("title")} />;
}
