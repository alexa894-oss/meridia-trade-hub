import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "./sign-up-form";

export default async function SignUpPage({ params }: PageProps<"/[locale]/crear-cuenta">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SignUp");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <SignUpForm />
    </AuthCard>
  );
}
