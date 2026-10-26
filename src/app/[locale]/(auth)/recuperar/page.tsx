import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { ResetRequestForm } from "./reset-request-form";

export default async function RecoverPage({ params }: PageProps<"/[locale]/recuperar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Recover");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <ResetRequestForm />
    </AuthCard>
  );
}
