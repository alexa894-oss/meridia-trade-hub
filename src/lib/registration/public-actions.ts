"use server";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { compact, hasErrors, normalizeUrl, validatePassword, type FieldErrorCode } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { REQUEST_BASE } from "./steps";
import {
  contactFields,
  detailsFields,
  profileFields,
  validateContact,
  validateDetails,
  validateProfile,
  type ContactField,
  type DetailsField,
  type ProfileField,
} from "./validate";

// Formulario público "Solicitar acceso": se llena completo y, al final, se crean
// la cuenta y la solicitud en un solo envío. El correo se confirma después.

type StepErrors = Partial<Record<string, FieldErrorCode>>;
export type PublicStep = "datos" | "contacto" | "perfil" | "enviar";
export type PublicResult =
  | { status: "ok" }
  | { status: "error"; step: PublicStep; fieldErrors?: StepErrors; formError?: string }
  | { status: "submitted"; loggedIn: boolean; email: string };

type Values = Record<string, string>;
const pick = <F extends string>(v: Values, fields: readonly F[]) =>
  Object.fromEntries(fields.map((f) => [f, (v[f] ?? "").trim()])) as Record<F, string>;

async function allowIndividual() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_settings");
  return (data as Record<string, unknown> | null)?.allow_individual_buyers !== false;
}

function check(step: PublicStep, v: Values, individualAllowed: boolean): StepErrors {
  const isCompany = v.accountType === "company";
  if (step === "datos") return compact(validateDetails(pick(v, detailsFields) as Record<DetailsField, string>, individualAllowed));
  if (step === "contacto") return compact(validateContact(pick(v, contactFields) as Record<ContactField, string>, isCompany));
  if (step === "perfil") return compact(validateProfile(pick(v, profileFields) as Record<ProfileField, string>, isCompany));
  return {};
}

// Valida un paso sin guardar nada (para avanzar en el formulario).
export async function validateAccessStep(step: PublicStep, values: Values): Promise<PublicResult> {
  const errors = check(step, values, await allowIndividual());
  return hasErrors(errors) ? { status: "error", step, fieldErrors: errors } : { status: "ok" };
}

async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const submitErrorMap: Record<string, { step: PublicStep; error: string }> = {
  "missing:details": { step: "datos", error: "missingDetails" },
  "missing:contact": { step: "contacto", error: "missingContact" },
  "missing:profile": { step: "perfil", error: "missingProfile" },
  "missing:legal": { step: "enviar", error: "missingLegal" },
  individuals_not_allowed: { step: "datos", error: "individualsNotAllowed" },
  // Cuenta que ya existía (por ejemplo, registrada antes sin confirmar): no se reutiliza.
  not_allowed: { step: "contacto", error: "emailTaken" },
};

// Envío final: revalida todo, crea la cuenta y guarda la solicitud (queda "recibida").
export async function submitAccessRequest(values: Values, legalKinds: string[]): Promise<PublicResult> {
  if (!isSupabaseConfigured) return { status: "error", step: "enviar", formError: "notConfigured" };
  const individualAllowed = await allowIndividual();
  for (const step of ["datos", "contacto", "perfil"] as const) {
    const errors = check(step, values, individualAllowed);
    if (hasErrors(errors)) return { status: "error", step, fieldErrors: errors };
  }

  const password = values.password ?? "";
  const accepted = (name: string) => values[name] === "on";
  const finalErrors = compact({
    password: validatePassword(password),
    passwordConfirm: !values.passwordConfirm ? "required" : values.passwordConfirm !== password ? "passwordMismatch" : undefined,
    acceptTerms: legalKinds.includes("terms") && !accepted("acceptTerms") ? "mustAccept" : undefined,
    acceptPrivacy: legalKinds.includes("privacy") && !accepted("acceptPrivacy") ? "mustAccept" : undefined,
    acceptNonCircumvention: legalKinds.includes("non_circumvention") && !accepted("acceptNonCircumvention") ? "mustAccept" : undefined,
  } satisfies Record<string, FieldErrorCode | undefined>);
  if (hasErrors(finalErrors)) return { status: "error", step: "enviar", fieldErrors: finalErrors };

  const isCompany = values.accountType === "company";
  const email = values.email.trim().toLowerCase();
  const fullName = (isCompany ? values.contactName : values.fullName).trim();
  const locale = await getLocale();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(REQUEST_BASE)}`,
      data: { full_name: fullName, locale },
    },
  });
  if (error || !data.user) {
    const formError =
      error?.code === "user_already_exists" || error?.code === "email_exists"
        ? "emailTaken"
        : error?.code === "weak_password"
          ? "weakPassword"
          : error?.code === "over_email_send_rate_limit"
            ? "rateLimited"
            : error?.code === "email_address_invalid" || error?.code === "email_address_not_authorized"
              ? "emailUndeliverable"
              : "submitFailed";
    // El correo está mal o ya existe: se corrige en el paso de contacto; lo demás, en el último paso.
    const step = formError === "emailTaken" || formError === "emailUndeliverable" ? "contacto" : "enviar";
    return { status: "error", step, formError };
  }
  // Con confirmación de correo activa, un correo ya registrado no da error: vuelve sin identidades.
  if (data.user.identities && data.user.identities.length === 0) {
    return { status: "error", step: "contacto", formError: "emailTaken" };
  }

  const { error: requestError } = await supabase.rpc("submit_access_request", {
    p_user: data.user.id,
    p_data: {
      account_type: values.accountType,
      country: values.country,
      legal_name: values.legalName,
      trade_name: values.tradeName,
      tax_id: values.taxId,
      website: isCompany ? (normalizeUrl(values.website ?? "").value ?? "") : "",
      economic_activity: values.economicActivity,
      sector_id: values.sectorId,
      full_name: values.fullName,
      id_type: values.idType,
      id_number: values.idNumber,
      contact_name: values.contactName,
      contact_title: values.contactTitle,
      contact_email: email,
      // Solo se pide WhatsApp; la base de datos exige teléfono, así que se guarda el mismo número.
      phone: values.whatsapp,
      whatsapp: values.whatsapp,
      contact_country: values.contactCountry,
      city: values.city,
      representative_authorized: values.authorized === "on",
      company_type: values.companyType,
      category_ids: (values.categoryIds ?? "").split(",").filter(Boolean),
      destination_country: values.destinationCountry,
      purchase_volume: values.purchaseVolume,
      purchase_purpose: values.purchasePurpose,
      needs_description: values.needsDescription,
      other_products: values.otherProducts,
      accepted_legal: true,
    },
  });
  if (requestError) {
    const mapped = submitErrorMap[requestError.message];
    return mapped
      ? { status: "error", step: mapped.step, formError: mapped.error }
      : { status: "error", step: "enviar", formError: "submitFailed" };
  }

  return { status: "submitted", loggedIn: !!data.session, email };
}
