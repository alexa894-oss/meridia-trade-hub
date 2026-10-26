"use client";

import React, { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import type { FieldErrorCode } from "@/lib/forms";
import { MIN_PASSWORD_LENGTH } from "@/lib/forms";

// Mensaje de error que nombra el campo: "Completa el campo «Correo electrónico»."
export function useFieldError() {
  const t = useTranslations("Forms.errors");
  return (code: FieldErrorCode | undefined, label: string, values?: Record<string, string | number>) =>
    code ? t(code, { field: label, min: MIN_PASSWORD_LENGTH, ...values }) : undefined;
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

const controlClass = (error?: string) =>
  `mt-1.5 block w-full rounded-(--radius-control) border bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-navy-800 ${
    error ? "border-danger" : "border-line"
  }`;

function Help({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error)
    return (
      <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
        {error}
      </p>
    );
  if (hint)
    return (
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
        {hint}
      </p>
    );
  return null;
}

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
};

export function SelectField({ label, error, hint, placeholder, options, id, className = "", ...select }: SelectFieldProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={selectId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {/* key: tras un error, React reinicia el formulario y un <select> volvería a su
          opción inicial; al cambiar el valor por defecto se vuelve a montar con el elegido. */}
      <select
        key={String(select.defaultValue ?? "")}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
        className={`${controlClass(error)} min-h-12`}
        {...select}
      >
        <option value="">{placeholder ?? ""}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Help id={selectId} error={error} hint={hint} />
    </div>
  );
}

type TextareaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextareaField({ label, error, hint, id, className = "", ...textarea }: TextareaFieldProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={areaId} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={areaId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined}
        className={`${controlClass(error)} py-3`}
        {...textarea}
      />
      <Help id={areaId} error={error} hint={hint} />
    </div>
  );
}

export function CheckboxField({
  label,
  error,
  className = "",
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; error?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-navy-800"
          {...input}
        />
        <span className="text-ink">{label}</span>
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
