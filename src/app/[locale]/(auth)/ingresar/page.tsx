import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({ params, searchParams }: PageProps<"/[locale]/ingresar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("SignIn");

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <Suspense fallback={<SignInForm />}>
        <SignInFormWithParams searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignInFormWithParams({ searchParams }: { searchParams: PageProps<"/[locale]/ingresar">["searchParams"] }) {
  const { next, error } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : undefined} linkError={error === "link"} />;
}
