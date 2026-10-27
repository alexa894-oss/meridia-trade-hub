// Pasos de la solicitud de acceso (empresa o persona natural). El slug va en la URL.
// Las fábricas no se registran solas: las incorpora Meridia desde el panel.
export const buyerSteps = ["datos", "contacto", "perfil", "verificacion"] as const;

export type BuyerStep = (typeof buyerSteps)[number];
export type RegistrationStep = BuyerStep;

// Seguimiento de la solicitud y pasos del formulario.
export const REQUEST_BASE = "/comprador/solicitud";

export function nextStepPath(current: RegistrationStep) {
  const i = buyerSteps.indexOf(current);
  return `${REQUEST_BASE}/${buyerSteps[Math.min(i + 1, buyerSteps.length - 1)]}`;
}

export const accountTypes = ["company", "individual"] as const;
export type AccountType = (typeof accountTypes)[number];

export const companyTypes = ["construction", "importer", "distributor", "retail", "manufacturer", "other"] as const;
export const idTypes = ["national_id", "passport", "residence_permit", "other"] as const;

// Tipos de documento que existen en company_documents.
export const documentKinds = ["tax_registration", "representation", "id_document", "cn_business_license", "brochure", "other"] as const;
export type DocumentKind = (typeof documentKinds)[number];

// Lo que puede subir un solicitante (todo opcional: Meridia pide lo que falte).
export const applicantDocumentKinds: DocumentKind[] = ["tax_registration", "representation", "id_document", "other"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
