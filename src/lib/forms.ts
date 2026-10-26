// Validación de formularios compartida entre servidor y cliente.
// Los errores son claves de traducción (Forms.errors.*); la interfaz las
// combina con la etiqueta del campo para nombrarlo en el mensaje.

export type FieldErrorCode =
  | "required"
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordMismatch"
  | "invalidChoice"
  | "invalidPhone"
  | "invalidUrl"
  | "invalidYear"
  | "tooShort"
  | "selectAtLeastOne"
  | "mustAccept"
  | "fileRequired"
  | "webOrBrochure"
  | "invalidPercent"
  | "endBeforeStart"
  | "noShowroom"
  | "invalidAmount"
  | "invalidCurrency"
  | "invalidHours";

export type FormState<F extends string = string> = {
  status: "idle" | "error" | "success";
  fieldErrors?: Partial<Record<F, FieldErrorCode>>;
  formError?: string;
  message?: string;
  values?: Partial<Record<F, string>>;
};

export const initialFormState: FormState = { status: "idle" };

export const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function readString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function validateEmail(value: string): FieldErrorCode | undefined {
  if (!value) return "required";
  if (!EMAIL_RE.test(value)) return "invalidEmail";
}

export function validatePassword(value: string): FieldErrorCode | undefined {
  if (!value) return "required";
  if (value.length < MIN_PASSWORD_LENGTH) return "passwordTooShort";
}

export function validateRequired(value: string): FieldErrorCode | undefined {
  if (!value) return "required";
}

// Teléfono internacional flexible: +, dígitos, espacios, guiones, puntos, paréntesis.
export function validatePhone(value: string): FieldErrorCode | undefined {
  if (!value) return "required";
  const digits = value.replace(/\D/g, "");
  if (!/^[+\d][\d\s().-]+$/.test(value) || digits.length < 6 || digits.length > 20) return "invalidPhone";
}

// Acepta "midominio.com" y le agrega https://. Devuelve el valor normalizado.
export function normalizeUrl(value: string): { value: string | null; error?: FieldErrorCode } {
  if (!value) return { value: null };
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes(".")) return { value: null, error: "invalidUrl" };
    return { value: url.toString() };
  } catch {
    return { value: null, error: "invalidUrl" };
  }
}

export function validateYear(value: string): FieldErrorCode | undefined {
  if (!value) return;
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1800 || year > new Date().getFullYear()) return "invalidYear";
}

export function hasErrors(errors: Record<string, FieldErrorCode | undefined>) {
  return Object.values(errors).some(Boolean);
}

export function compact<F extends string>(errors: Record<F, FieldErrorCode | undefined>) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<Record<F, FieldErrorCode>>;
}
