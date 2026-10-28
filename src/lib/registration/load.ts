import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";
import type { AccountType, DocumentKind } from "./steps";

export type Localized = Record<string, string>;
export type Option = { id: string; slug: string; names: Localized };

export type CompanyStatus = Database["public"]["Enums"]["company_status"];
type LegalKind = Database["public"]["Enums"]["legal_document_kind"];

export type RegistrationData = {
  company: { id: string; status: CompanyStatus; country: string; sectorId: string | null; submittedAt: string | null } | null;
  buyer: {
    accountType: AccountType;
    legalName: string | null;
    tradeName: string | null;
    taxId: string | null;
    economicActivity: string | null;
    website: string | null;
    fullName: string | null;
    idType: string | null;
    idNumber: string | null;
    companyType: string | null;
    representativeAuthorized: boolean;
    destinationCountry: string | null;
    purchaseVolume: string | null;
    purchaseFrequencyId: string | null;
    purchasePurpose: string | null;
    needsDescription: string | null;
    otherProducts: string | null;
  } | null;
  contact: {
    name: string;
    title: string | null;
    phone: string | null;
    email: string | null;
    whatsapp: string | null;
    city: string | null;
    country: string | null;
  } | null;
  categoryIds: string[];
  documents: { id: string; kind: DocumentKind; fileName: string | null; storagePath: string; createdAt: string }[];
  legalDocuments: { id: string; kind: LegalKind; version: number; content: Localized; isDraft: boolean }[];
  acceptedLegalIds: string[];
  latestReview: { action: string; message: string | null; createdAt: string } | null;
  history: { toStatus: string; createdAt: string }[];
  allowIndividualBuyers: boolean;
};

export const editableStatuses: CompanyStatus[] = ["registered", "info_requested"];

// Todo lo que la solicitud necesita, leído con la sesión del usuario (RLS).
export async function loadRegistration(profile: CurrentProfile): Promise<RegistrationData> {
  const supabase = await createClient();

  const [legal, accepted, settings] = await Promise.all([
    supabase.rpc("current_legal_documents"),
    supabase.from("legal_acceptances").select("legal_document_id").eq("user_id", profile.id),
    supabase.rpc("get_public_settings"),
  ]);

  const base = {
    legalDocuments: (legal.data ?? []).map((d) => ({
      id: d.id,
      kind: d.kind,
      version: d.version,
      content: d.content as Localized,
      isDraft: d.is_draft,
    })),
    acceptedLegalIds: (accepted.data ?? []).map((a) => a.legal_document_id),
    allowIndividualBuyers: (settings.data as Record<string, unknown> | null)?.allow_individual_buyers !== false,
  };

  if (!profile.companyId) {
    return { ...base, company: null, buyer: null, contact: null, categoryIds: [], documents: [], latestReview: null, history: [] };
  }

  const id = profile.companyId;
  const [company, buyer, contact, categories, documents, reviews, history] = await Promise.all([
    supabase.from("companies").select("id, status, country, sector_id, submitted_at").eq("id", id).maybeSingle(),
    supabase.from("buyer_details").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("company_contacts").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("buyer_categories").select("category_id").eq("buyer_company_id", id),
    supabase
      .from("company_documents")
      .select("id, kind, file_name, storage_path, created_at")
      .eq("company_id", id)
      .order("created_at"),
    supabase
      .from("company_reviews")
      .select("action, message, created_at")
      .eq("company_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("status_history")
      .select("to_status, created_at")
      .eq("entity_type", "company")
      .eq("entity_id", id)
      .order("created_at"),
  ]);

  const b = buyer.data;
  const c = contact.data;
  return {
    ...base,
    company: company.data
      ? {
          id: company.data.id,
          status: company.data.status,
          country: company.data.country,
          sectorId: company.data.sector_id,
          submittedAt: company.data.submitted_at,
        }
      : null,
    buyer: b
      ? {
          accountType: b.account_type,
          legalName: b.legal_name,
          tradeName: b.trade_name,
          taxId: b.tax_id,
          economicActivity: b.economic_activity,
          website: b.website,
          fullName: b.full_name,
          idType: b.id_type,
          idNumber: b.id_number,
          companyType: b.company_type,
          representativeAuthorized: b.representative_authorized,
          destinationCountry: b.destination_country,
          purchaseVolume: b.purchase_volume,
          purchaseFrequencyId: b.purchase_frequency_id,
          purchasePurpose: b.purchase_purpose,
          needsDescription: b.project_description,
          otherProducts: b.other_products,
        }
      : null,
    contact: c
      ? {
          name: c.contact_name,
          title: c.contact_title,
          phone: c.phone,
          email: c.email,
          whatsapp: c.whatsapp,
          city: c.city,
          country: c.country,
        }
      : null,
    categoryIds: (categories.data ?? []).map((x) => x.category_id),
    documents: (documents.data ?? []).map((d) => ({
      id: d.id,
      kind: d.kind as DocumentKind,
      fileName: d.file_name,
      storagePath: d.storage_path,
      createdAt: d.created_at,
    })),
    latestReview: reviews.data?.[0]
      ? { action: reviews.data[0].action, message: reviews.data[0].message, createdAt: reviews.data[0].created_at }
      : null,
    history: (history.data ?? []).map((h) => ({ toStatus: h.to_status, createdAt: h.created_at })),
  };
}

export async function loadOptions() {
  const supabase = await createClient();
  const [sectors, categories, frequencies] = await Promise.all([
    supabase.from("sectors").select("id, slug, names").eq("active", true).order("sort_order"),
    supabase.from("categories").select("id, slug, names").order("sort_order"),
    supabase.from("purchase_frequencies").select("id, slug, names").order("sort_order"),
  ]);
  return {
    sectors: (sectors.data ?? []) as Option[],
    categories: (categories.data ?? []) as Option[],
    frequencies: (frequencies.data ?? []) as Option[],
  };
}

// Estado de la empresa del usuario actual (para bloquear la operación hasta la aprobación).
export async function loadCompanyStatus(companyId: string | null): Promise<CompanyStatus | null> {
  if (!companyId) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("status").eq("id", companyId).maybeSingle();
  return data?.status ?? null;
}

export function localized(names: Localized, locale: string) {
  return names[locale] ?? names.es ?? Object.values(names)[0] ?? "";
}
