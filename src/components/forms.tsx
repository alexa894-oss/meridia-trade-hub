"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { FieldErrorCode } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/forms";

// Mensaje de error que nombra el campo: "Completa el campo «Correo electrónico»."
export function useFieldError() {
  const t = useTranslations("Forms.errors");
  return (code: FieldErrorCode | undefined, label: string) =>
    code ? t(code, { field: label, min: MIN_PASSWORD_LENGTH }) : undefined;
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Field({ label, error, hint, id, className = "", ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={inputId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`mt-1.5 block min-h-12 w-full rounded-(--radius-control) border bg-surface px-3.5 text-base text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-navy-800 ${
          error ? "border-danger" : "border-line"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  const t = useTranslations("Forms");
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full items-center justify-center rounded-(--radius-control) bg-navy-800 px-6 font-display text-base font-semibold text-white transition-colors hover:bg-navy-900 disabled:opacity-60"
    >
      {pending ? t("sending") : children}
    </button>
  );
}

export function FormAlert({ tone = "error", children }: { tone?: "error" | "success"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-(--radius-control) border px-4 py-3 text-sm ${
        tone === "error"
          ? "border-danger/30 bg-danger/5 text-danger"
          : "border-success/30 bg-success/5 text-success"
      }`}
    >
      {children}
    </div>
  );
}
