"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/roles";
import {
  compact,
  hasErrors,
  readString,
  validateEmail,
  validatePassword,
  validateRequired,
  type FormState,
} from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function notConfigured<F extends string>(): FormState<F> {
  return { status: "error", formError: "notConfigured" };
}

// ---------------------------------------------------------------------------
// Ingresar
// ---------------------------------------------------------------------------
type SignInField = "email" | "password";

export async function signIn(_prev: FormState<SignInField>, formData: FormData): Promise<FormState<SignInField>> {
  const email = readString(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const errors = { email: validateEmail(email), password: validateRequired(password) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { email } };
  if (!isSupabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const formError = error.code === "email_not_confirmed" ? "emailNotConfirmed" : "invalidCredentials";
    return { status: "error", formError, values: { email } };
  }

  redirect({ href: safeNextPath(formData.get("next")), locale: await getLocale() });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Crear cuenta (comprador o fábrica; el administrador nunca se crea aquí)
// ---------------------------------------------------------------------------
type SignUpField = "accountRole" | "fullName" | "email" | "password" | "passwordConfirm";

export async function signUp(_prev: FormState<SignUpField>, formData: FormData): Promise<FormState<SignUpField>> {
  const accountRole = readString(formData, "accountRole");
  const fullName = readString(formData, "fullName");
  const email = readString(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const errors = {
    accountRole: !accountRole
      ? ("required" as const)
      : accountRole === "buyer" || accountRole === "factory"
        ? undefined
        : ("invalidChoice" as const),
    fullName: validateRequired(fullName),
    email: validateEmail(email),
    password: validatePassword(password),
    passwordConfirm: !passwordConfirm
      ? ("required" as const)
      : passwordConfirm !== password
        ? ("passwordMismatch" as const)
        : undefined,
  };
  const values = { accountRole, fullName, email };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values };
  if (!isSupabaseConfigured) return notConfigured();

  const locale = await getLocale();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/panel`,
      data: { signup_role: accountRole, full_name: fullName, locale },
    },
  });

  if (error) {
    const formError =
      error.code === "user_already_exists" || error.code === "email_exists"
        ? "emailTaken"
        : error.code === "weak_password"
          ? "weakPassword"
          : error.code === "over_email_send_rate_limit"
            ? "rateLimited"
            : error.code === "email_address_invalid" || error.code === "email_address_not_authorized"
              ? "emailUndeliverable"
              : "signUpFailed";
    return { status: "error", formError, values };
  }

  // Con confirmación de correo desactivada, Supabase ya abre la sesión.
  if (data.session) redirect({ href: "/panel", locale });

  return { status: "success", message: "checkEmail", values: { email } };
}

// ---------------------------------------------------------------------------
// Recuperar contraseña (no revela si el correo existe)
// ---------------------------------------------------------------------------
type ResetField = "email";

export async function requestPasswordReset(
  _prev: FormState<ResetField>,
  formData: FormData,
): Promise<FormState<ResetField>> {
  const email = readString(formData, "email").toLowerCase();
  const errors = { email: validateEmail(email) };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors), values: { email } };
  if (!isSupabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/confirm?next=/restablecer`,
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { status: "error", formError: "rateLimited", values: { email } };
  }
  return { status: "success", message: "resetSent", values: { email } };
}

// ---------------------------------------------------------------------------
// Definir nueva contraseña (requiere la sesión abierta por el enlace del correo)
// ---------------------------------------------------------------------------
type NewPasswordField = "password" | "passwordConfirm";

export async function updatePassword(
  _prev: FormState<NewPasswordField>,
  formData: FormData,
): Promise<FormState<NewPasswordField>> {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const errors = {
    password: validatePassword(password),
    passwordConfirm: !passwordConfirm
      ? ("required" as const)
      : passwordConfirm !== password
        ? ("passwordMismatch" as const)
        : undefined,
  };
  if (hasErrors(errors)) return { status: "error", fieldErrors: compact(errors) };
  if (!isSupabaseConfigured) return notConfigured();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { status: "error", formError: "linkExpired" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    const formError =
      error.code === "same_password" ? "samePassword" : error.code === "weak_password" ? "weakPassword" : "updateFailed";
    return { status: "error", formError };
  }

  redirect({ href: "/panel", locale: await getLocale() });
  return { status: "success" };
}

// ---------------------------------------------------------------------------
// Salir
// ---------------------------------------------------------------------------
export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect({ href: "/", locale: await getLocale() });
}
