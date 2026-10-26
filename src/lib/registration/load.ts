import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CurrentProfile } from "@/lib/auth/session";
import type { DocumentKind } from "./steps";

export type Localized = Record<string, string>;
export type Option = { id: string; slug: string; names: Localized };

export type CompanyStatus = "registered" | "in_review" | "validated" | "info_requested" | "rejected" | "suspended";

export type RegistrationData = {
  company: { id: string; status: CompanyStatus; country: string; sectorId: string | null } | null;
  buyer: {
    accountType: "company" | "individual";
    legalName: string | null;
    taxId: string | null;
    website: string | null;
    fullName: string | null;
    projectDescription: string | null;
  } | null;
  factory: {
    legalNameZh: string;
    legalNameEn: string;
    city: string;
    province: string;
    website: string | null;
    capacity: string | null;
    departurePort: string | null;
    foundedYear: number | null;
    annualCapacityOrSales: string | null;
  } | null;
  contact: { name: string; title: string | null; phone: string | null; email: string | null; wechat: string | null } | null;
  categoryIds: string[];
  documents: { id: string; kind: DocumentKind; fileName: string | null; storagePath: string; createdAt: string }[];
  legalDocuments: { id: string; kind: "terms" | "non_circumvention"; version: number; content: Localized; isDraft: boolean }[];
  acceptedLegalIds: string[];
  latestReview: { action: string; message: string | null; createdAt: string } | null;
  allowIndividualBuyers: boolean;
};

export const editableStatuses: CompanyStatus[] = ["registered", "info_requested"];

// Todo lo que el registro necesita, leído con la sesión del usuario (RLS).
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
    return {
      ...base,
      company: null,
      buyer: null,
      factory: null,
      contact: null,
      categoryIds: [],
      documents: [],
      latestReview: null,
    };
  }

  const id = profile.companyId;
  const [company, buyer, factory, contact, categories, documents, reviews] = await Promise.all([
    supabase.from("companies").select("id, status, country, sector_id").eq("id", id).maybeSingle(),
    supabase.from("buyer_details").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("factory_details").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("company_contacts").select("*").eq("company_id", id).maybeSingle(),
    supabase.from("factory_categories").select("category_id").eq("factory_company_id", id),
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
  ]);

  return {
    ...base,
    company: company.data
      ? {
          id: company.data.id,
          status: company.data.status as CompanyStatus,
          country: company.data.country,
          sectorId: company.data.sector_id,
        }
      : null,
    buyer: buyer.data
      ? {
          accountType: buyer.data.account_type,
          legalName: buyer.data.legal_name,
          taxId: buyer.data.tax_id,
          website: buyer.data.website,
          fullName: buyer.data.full_name,
          projectDescription: buyer.data.project_description,
        }
      : null,
    factory: factory.data
      ? {
          legalNameZh: factory.data.legal_name_zh,
          legalNameEn: factory.data.legal_name_en,
          city: factory.data.city,
          province: factory.data.province,
          website: factory.data.website,
          capacity: factory.data.capacity,
          departurePort: factory.data.departure_port,
          foundedYear: factory.data.founded_year,
          annualCapacityOrSales: factory.data.annual_capacity_or_sales,
        }
      : null,
    contact: contact.data
      ? {
          name: contact.data.contact_name,
          title: contact.data.contact_title,
          phone: contact.data.phone,
          email: contact.data.email,
          wechat: contact.data.wechat,
        }
      : null,
    categoryIds: (categories.data ?? []).map((c) => c.category_id),
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
  };
}

export async function loadOptions() {
  const supabase = await createClient();
  const [sectors, categories] = await Promise.all([
    supabase.from("sectors").select("id, slug, names").order("sort_order"),
    supabase.from("categories").select("id, slug, names").order("sort_order"),
  ]);
  return {
    sectors: (sectors.data ?? []) as Option[],
    categories: (categories.data ?? []) as Option[],
  };
}

export function localized(names: Localized, locale: string) {
  return names[locale] ?? names.es ?? Object.values(names)[0] ?? "";
}
