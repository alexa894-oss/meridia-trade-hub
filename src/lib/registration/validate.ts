import { isCountryCode } from "@/lib/countries";
import { normalizeUrl, validateEmail, validatePhone, validateRequired, type FieldErrorCode } from "@/lib/forms";
import { companyTypes, idTypes } from "./steps";

// Validación de la solicitud de acceso, compartida por el formulario público
// (todo antes de crear la cuenta) y por la edición con sesión. Sin efectos.

type Errors<F extends string> = Record<F, FieldErrorCode | undefined>;

export const choice = (value: string, options: readonly string[]): FieldErrorCode | undefined =>
  !value ? "required" : options.includes(value) ? undefined : "invalidChoice";
export const country = (value: string): FieldErrorCode | undefined =>
  !value ? "required" : isCountryCode(value) ? undefined : "invalidChoice";

// Paso 1 · Empresa: información empresarial · Persona natural: datos personales
export const detailsFields = [
  "accountType",
  "country",
  "legalName",
  "tradeName",
  "taxId",
  "economicActivity",
  "sectorId",
  "website",
  "fullName",
  "idType",
  "idNumber",
] as const;
export type DetailsField = (typeof detailsFields)[number];

export function validateDetails(v: Record<DetailsField, string>, allowIndividual: boolean): Errors<DetailsField> {
  const isCompany = v.accountType === "company";
  return {
    accountType: choice(v.accountType, allowIndividual ? ["company", "individual"] : ["company"]),
    country: country(v.country),
    legalName: isCompany ? validateRequired(v.legalName) : undefined,
    tradeName: isCompany ? validateRequired(v.tradeName) : undefined,
    taxId: isCompany ? validateRequired(v.taxId) : undefined,
    economicActivity: validateRequired(v.economicActivity),
    sectorId: validateRequired(v.sectorId),
    website: isCompany ? normalizeUrl(v.website).error : undefined,
    fullName: !isCompany ? validateRequired(v.fullName) : undefined,
    idType: !isCompany ? choice(v.idType, idTypes) : undefined,
    idNumber: !isCompany ? validateRequired(v.idNumber) : undefined,
  };
}

// Paso 2 · Representante y contacto
export const contactFields = ["contactName", "contactTitle", "email", "whatsapp", "contactCountry", "city", "authorized"] as const;
export type ContactField = (typeof contactFields)[number];

export function validateContact(v: Record<ContactField, string>, isCompany: boolean): Errors<ContactField> {
  return {
    contactName: isCompany ? validateRequired(v.contactName) : undefined,
    contactTitle: isCompany ? validateRequired(v.contactTitle) : undefined,
    email: validateEmail(v.email),
    whatsapp: validatePhone(v.whatsapp),
    contactCountry: isCompany ? country(v.contactCountry) : undefined,
    city: isCompany ? validateRequired(v.city) : undefined,
    authorized: isCompany && v.authorized !== "on" ? "mustAccept" : undefined,
  };
}

// Paso 3 · Perfil de compra
export const profileFields = [
  "companyType",
  "categoryIds",
  "destinationCountry",
  "purchaseVolume",
  "purchasePurpose",
  "needsDescription",
  "otherProducts",
] as const;
export type ProfileField = (typeof profileFields)[number];

export function validateProfile(v: Record<ProfileField, string>, isCompany: boolean): Errors<ProfileField> {
  return {
    companyType: isCompany ? choice(v.companyType, companyTypes) : undefined,
    // Al menos una categoría o un producto escrito en "Otro producto".
    categoryIds: v.categoryIds || v.otherProducts ? undefined : "selectAtLeastOne",
    destinationCountry: country(v.destinationCountry),
    purchaseVolume: validateRequired(v.purchaseVolume),
    purchasePurpose: !isCompany ? validateRequired(v.purchasePurpose) : undefined,
    needsDescription: undefined,
    otherProducts: v.otherProducts.length > 500 ? "tooLong" : undefined,
  };
}

// Lee los campos de un paso desde un FormData (categoryIds se une con comas).
export function readFields<F extends string>(formData: FormData, fields: readonly F[]): Record<F, string> {
  const out = {} as Record<F, string>;
  for (const f of fields) {
    out[f] =
      f === "categoryIds"
        ? formData.getAll(f).filter((x): x is string => typeof x === "string" && !!x).join(",")
        : f === "authorized"
          ? formData.get(f) === "on" ? "on" : ""
          : String(formData.get(f) ?? "").trim();
  }
  return out;
}
