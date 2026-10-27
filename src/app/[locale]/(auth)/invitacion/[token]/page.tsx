import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { PageLoading } from "@/components/page-loading";
import { createClient } from "@/lib/supabase/server";
import { InvitationForm } from "./invitation-form";

// Invitación privada de Meridia para un fabricante de su red.
export default async function InvitationPage({ params }: PageProps<"/[locale]/invitacion/[token]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invitation");
  return (
    <AuthCard title={t("title")}>
      <Suspense fallback={<PageLoading />}>
        <InvitationContent params={params} />
      </Suspense>
    </AuthCard>
  );
}

async function InvitationContent({ params }: { params: PageProps<"/[locale]/invitacion/[token]">["params"] }) {
  const [{ token }, t] = await Promise.all([params, getTranslations("Invitation")]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_factory_invitation", { p_token: token });
  const invite = data?.[0];
  if (!invite) return <p className="text-ink">{t("invalid")}</p>;
  return (
    <div className="space-y-5">
      <p className="text-ink">{t("intro", { company: invite.company_name ?? "" })}</p>
      <InvitationForm token={token} email={invite.email} />
    </div>
  );
}
