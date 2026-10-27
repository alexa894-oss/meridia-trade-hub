"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { compact, hasErrors, readString, validatePassword, validateRequired, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

type Field = "fullName" | "password" | "passwordConfirm";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Acepta la invitación privada: crea la cuenta con el correo invitado y la vincula a su fábrica.
export async function acceptInvitation(token: string, _prev: FormState<Field>, formData: FormData): Promise<FormState<Field>> {
  const fullName = readString(formData, "fullName");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const errors = {
    fullName: validateRequired(fullName),
    password: validatePassword(password),
    passwordConfirm: !passwordConfirm ? ("required" as const) : passwordConfirm !== password ? ("passwordMismatch" as const) : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { fullName } };

  const supabase = await createClient();
  // El correo sale de la invitación (no del formulario).
  const { data: invitation } = await supabase.rpc("get_factory_invitation", { p_token: token });
  const invite = invitation?.[0];
  if (!invite) return { status: "error", formError: "invalid" };

  const locale = await getLocale();
  const { data, error } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/fabrica`,
      data: { full_name: fullName, locale },
    },
  });
  if (error || !data.user || data.user.identities?.length === 0) {
    const formError =
      !error || error.code === "user_already_exists" || error.code === "email_exists"
        ? "emailTaken"
        : error.code === "weak_password"
          ? "weakPassword"
          : error.code === "over_email_send_rate_limit"
            ? "rateLimited"
            : "failed";
    return { status: "error", formError, values: { fullName } };
  }

  const { error: acceptError } = await supabase.rpc("accept_factory_invitation", { p_token: token, p_user: data.user.id });
  if (acceptError) return { status: "error", formError: acceptError.message === "invitation_invalid" ? "invalid" : "failed", values: { fullName } };

  if (data.session) redirect({ href: "/fabrica", locale });
  return { status: "success", message: invite.email };
}
