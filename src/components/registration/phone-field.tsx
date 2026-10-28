"use client";

import { useId, useState } from "react";
import { dialCodes, splitPhone } from "@/lib/dial-codes";

type Option = { value: string; label: string };

// Número con prefijo de país: se elige el país (el código sale solo) y luego se escribe el número.
// Envía el número completo ("+507 6000-0000") en un campo oculto con el nombre indicado.
export function PhoneField({
  name,
  label,
  countryLabel,
  numberLabel,
  hint,
  countries,
  defaultValue,
  defaultCountry,
  error,
}: {
  name: string;
  label: string;
  countryLabel: string;
  numberLabel: string;
  hint?: string;
  countries: Option[];
  defaultValue: string;
  defaultCountry?: string;
  error?: string;
}) {
  const id = useId();
  const initial = splitPhone(defaultValue, defaultCountry);
  const [country, setCountry] = useState(initial.country || defaultCountry || "");
  const [number, setNumber] = useState(initial.number);
  const code = dialCodes[country];
  const full = number.trim() ? (code ? `+${code} ${number.trim()}` : number.trim()) : "";
  const control = `mt-1.5 block min-h-12 w-full rounded-(--radius-control) border bg-surface px-3.5 text-base text-ink outline-none transition-colors focus:border-navy-800 ${error ? "border-danger" : "border-line"}`;

  return (
    <fieldset aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <label htmlFor={`${id}-country`} className="sr-only">
            {countryLabel}
          </label>
          <select id={`${id}-country`} value={country} onChange={(e) => setCountry(e.target.value)} className={control}>
            <option value="">{countryLabel}</option>
            {countries
              .filter((c) => dialCodes[c.value])
              .map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label} (+{dialCodes[c.value]})
                </option>
              ))}
          </select>
        </div>
        <div className="flex items-stretch">
          <span aria-hidden className="mt-1.5 grid min-w-16 place-items-center rounded-l-(--radius-control) border border-r-0 border-line bg-surface-muted px-3 font-medium text-ink">
            {code ? `+${code}` : "+"}
          </span>
          <label htmlFor={`${id}-number`} className="sr-only">
            {numberLabel}
          </label>
          <input
            id={`${id}-number`}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`${control} rounded-l-none`}
          />
        </div>
      </div>
      <input type="hidden" name={name} value={full} />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </fieldset>
  );
}
