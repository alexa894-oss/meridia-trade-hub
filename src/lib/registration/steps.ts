import type { Role } from "@/lib/auth/roles";

// Pasos del registro por tipo de cuenta. El slug va en la URL.
export const buyerSteps = ["datos", "contacto", "documento", "enviar"] as const;
export const factorySteps = ["empresa", "contacto", "produccion", "documentos", "enviar"] as const;

export type BuyerStep = (typeof buyerSteps)[number];
export type FactoryStep = (typeof factorySteps)[number];
export type RegistrationStep = BuyerStep | FactoryStep;

export function stepsFor(role: Extract<Role, "buyer" | "factory">): readonly RegistrationStep[] {
  return role === "buyer" ? buyerSteps : factorySteps;
}

export function registrationBase(role: Extract<Role, "buyer" | "factory">) {
  return role === "buyer" ? "/comprador/registro" : "/fabrica/registro";
}

export function nextStepPath(role: Extract<Role, "buyer" | "factory">, current: RegistrationStep) {
  const steps = stepsFor(role);
  const i = steps.indexOf(current);
  return `${registrationBase(role)}/${steps[Math.min(i + 1, steps.length - 1)]}`;
}

// Tipos de documento que el comprador o la fábrica pueden subir.
export const documentKinds = ["tax_registration", "id_document", "cn_business_license", "brochure", "other"] as const;
export type DocumentKind = (typeof documentKinds)[number];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
