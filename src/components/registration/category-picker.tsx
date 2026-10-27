// Selección múltiple de categorías (casillas). Envía "categoryIds" repetido.
export function CategoryPicker({
  label,
  hint,
  options,
  selected,
  error,
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  error?: string;
}) {
  return (
    <fieldset aria-describedby={error ? "categories-error" : undefined}>
      <legend className="text-sm font-medium text-ink">{label}</legend>
      {hint ? <p className="text-sm text-ink-muted">{hint}</p> : null}
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((c) => (
          <label
            key={c.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-line px-3 has-checked:border-navy-800 has-checked:bg-navy-50"
          >
            <input type="checkbox" name="categoryIds" value={c.value} defaultChecked={selected.has(c.value)} className="size-5 accent-navy-800" />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
      {error ? (
        <p id="categories-error" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
