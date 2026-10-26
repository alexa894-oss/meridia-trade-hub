import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/placeholder-page";

export default async function SignUpPage({ params }: PageProps<"/[locale]/crear-cuenta">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SignUp");
  return <PlaceholderPage title={t("title")} />;
}
