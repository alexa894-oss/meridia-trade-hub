"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import type { FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Registra la aceptación de cada versión pendiente (con fecha) y vuelve al panel.
export async function acceptPendingLegal(_prev: FormState, formData: FormData): Promise<FormState> {
  const profile = await getCurrentProfile();
  if (!profile) return { status: "error", formError: "notAllowed" };
  const supabase = await createClient();
  const { data: pending } = await supabase.rpc("pending_legal_documents");
  const missing = (pending ?? []).filter((d) => formData.get(`accept_${d.id}`) !== "on");
  if (missing.length) return { status: "error", formError: "mustAcceptAll" };
  if (pending?.length) {
    const { error } = await supabase
      .from("legal_acceptances")
      .upsert(pending.map((d) => ({ user_id: profile.id, legal_document_id: d.id })), { onConflict: "user_id,legal_document_id", ignoreDuplicates: true });
    if (error) return { status: "error", formError: "saveFailed" };
  }
  redirect({ href: "/panel", locale: await getLocale() });
  return { status: "success" };
}
