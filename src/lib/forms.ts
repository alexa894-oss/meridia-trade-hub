// Validación de formularios compartida entre servidor y cliente.
// Los errores son claves de traducción (Forms.errors.*); la interfaz las
// combina con la etiqueta del campo para nombrarlo en el mensaje.

export type FieldErrorCode =
  | "required"
  | "invalidEmail"
  | "passwordTooShort"
  | "passwordMismatch"
  | "invalidChoice";

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

export function hasErrors(errors: Record<string, FieldErrorCode | undefined>) {
  return Object.values(errors).some(Boolean);
}

export function compact<F extends string>(errors: Record<F, FieldErrorCode | undefined>) {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Partial<Record<F, FieldErrorCode>>;
}
