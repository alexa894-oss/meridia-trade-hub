import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { NewPasswordForm } from "./new-password-form";

// Llega aquí desde el enlace del correo de recuperación (el proxy exige sesión).
export default async function NewPasswordPage({ params }: PageProps<"/[locale]/restablecer">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("NewPassword");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <NewPasswordForm />
    </AuthCard>
  );
}
