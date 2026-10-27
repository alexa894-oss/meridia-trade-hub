import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { loadCompanyForReview } from "@/lib/admin/load";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { Card, DataList, formatDate, StatusBadge } from "@/components/admin/ui";
import { NoteForm } from "@/components/admin/notes-panel";
import { ReviewPanel } from "@/components/admin/review-panel";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Expediente de una solicitud de acceso: todo lo que envió el solicitante.
export default async function AccessRequestPage({ params }: PageProps<"/[locale]/admin/accesos/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadCompanyForReview(id);
  if (!data) notFound();
  const locale = await getLocale();
  if (data.company.kind !== "buyer") redirect({ href: `/admin/empresas/${id}`, locale });

  const [t, ta, ts, tf, tr, td] = await Promise.all([
    getTranslations("Admin.detail"),
    getTranslations("Admin.access"),
    getTranslations("Admin.status"),
    getTranslations("Registration.fields"),
    getTranslations("Registration"),
    getTranslations("Admin.documentKinds"),
  ]);
  const { company } = data;
  const b = company.buyer_details;
  const c = company.company_contacts;
  const isCompany = b?.account_type !== "individual";
  const names = (x: { names: unknown } | null | undefined) => (x ? localized(x.names as Record<string, string>, locale) : null);
  const country = (code: string | null | undefined) => (code ? countryName(code, locale) : null);
  const yes = (v: boolean | null | undefined) => (v ? ta("yes") : ta("no"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/accesos" className="text-sm font-semibold text-navy-800 hover:underline">
          ← {ta("back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{b?.trade_name ?? data.name ?? t("noName")}</h1>
          <StatusBadge status={company.status} label={ts(company.status)} />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {ta(`types.${b?.account_type ?? "company"}`)} · {countryName(company.country, locale)} ·{" "}
          {t("registeredAt", { date: formatDate(company.created_at, locale) })}
          {company.submitted_at ? ` · ${t("submittedAt", { date: formatDate(company.submitted_at, locale, true) })}` : ""}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-5">
          <Card title={isCompany ? tr("stepTitles.company.datos") : tr("stepTitles.individual.datos")}>
            {b ? (
              <DataList
                items={
                  isCompany
                    ? [
                        { label: tf("legalName"), value: b.legal_name },
                        { label: tf("tradeName"), value: b.trade_name },
                        { label: tf("incorporationCountry"), value: country(company.country) },
                        { label: tf("taxId"), value: b.tax_id },
                        { label: tf("economicActivity"), value: b.economic_activity },
                        { label: tf("sector"), value: names(company.sectors) },
                        { label: tf("website"), value: b.website },
                      ]
                    : [
                        { label: tf("fullName"), value: b.full_name },
                        { label: tf("residenceCountry"), value: country(company.country) },
                        { label: tf("idType"), value: b.id_type ? tr(`idTypes.${b.id_type}`) : null },
                        { label: tf("idNumber"), value: b.id_number },
                        { label: tf("economicActivity"), value: b.economic_activity },
                      ]
                }
              />
            ) : (
              <p className="text-ink-muted">{t("incomplete")}</p>
            )}
          </Card>

          <Card title={isCompany ? tr("stepTitles.company.contacto") : tr("stepTitles.individual.contacto")}>
            <p className="mb-4 rounded-(--radius-control) bg-gold-100 px-3 py-2 text-sm text-ink">{t("contactPrivate")}</p>
            {c ? (
              <DataList
                items={[
                  ...(isCompany
                    ? [
                        { label: tf("representativeName"), value: c.contact_name },
                        { label: tf("contactTitle"), value: c.contact_title },
                      ]
                    : []),
                  { label: isCompany ? tf("corporateEmail") : tf("email"), value: c.email },
                  { label: tf("phone"), value: c.phone },
                  { label: tf("whatsapp"), value: c.whatsapp },
                  ...(isCompany
                    ? [
                        { label: tf("contactCountry"), value: country(c.country) },
                        { label: tf("city"), value: c.city },
                        { label: tr("authorizedRepresentativeShort"), value: yes(b?.representative_authorized) },
                      ]
                    : []),
                ]}
              />
            ) : (
              <p className="text-ink-muted">{t("incomplete")}</p>
            )}
          </Card>

          <Card title={tr("stepTitles.company.perfil")}>
            {b?.destination_country || b?.purchase_volume ? (
              <DataList
                items={[
                  ...(isCompany
                    ? [{ label: tf("companyType"), value: b.company_type ? tr(`companyTypes.${b.company_type}`) : null }]
                    : [{ label: tf("purchasePurpose"), value: <span className="whitespace-pre-line">{b.purchase_purpose}</span> }]),
                  {
                    label: tf("interestCategories"),
                    value: company.buyer_categories.map((x) => names(x.categories)).filter(Boolean).join(", ") || null,
                  },
                  { label: tf("destinationCountry"), value: country(b.destination_country) },
                  { label: tf("purchaseVolume"), value: b.purchase_volume },
                  ...(isCompany
                    ? [
                        { label: tf("purchaseFrequency"), value: names(b.purchase_frequencies) },
                        { label: tf("needsDescription"), value: b.project_description ? <span className="whitespace-pre-line">{b.project_description}</span> : null },
                      ]
                    : []),
                ]}
              />
            ) : (
              <p className="text-ink-muted">{t("incomplete")}</p>
            )}
          </Card>

          <Card title={t("sections.documents")}>
            {data.documents.length ? (
              <ul className="space-y-2">
                {data.documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-line px-3 py-2">
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-navy-800">{td(d.kind)}</span>
                      <span className="block truncate text-sm text-ink-muted">
                        {d.fileName} · {formatDate(d.createdAt, locale)}
                      </span>
                    </span>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-navy-800 underline">
                        {t("open")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted">{ta("noDocuments")}</p>
            )}
          </Card>

          <Card title={t("sections.history")}>
            {data.history.length ? (
              <ol className="space-y-3">
                {data.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-gold-300 pl-3">
                    <p className="text-sm font-semibold text-navy-800">
                      {h.from_status ? `${ts(h.from_status as never)} → ` : ""}
                      {ts(h.to_status as never)}
                    </p>
                    <p className="text-xs text-ink-muted">{formatDate(h.created_at, locale, true)}</p>
                    {h.note ? <p className="mt-1 text-sm whitespace-pre-line text-ink">{h.note}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-ink-muted">—</p>
            )}
          </Card>
        </div>

        <div className="space-y-5 lg:sticky lg:top-4">
          <Card title={t("sections.review")}>
            <ReviewPanel companyId={company.id} kind="buyer" status={company.status} currentTier={null} hasLicense={false} />
          </Card>
          <Card title={ta("notesTitle")}>
            <p className="mb-3 text-sm text-ink-muted">{ta("notesPrivate")}</p>
            {data.notes.length ? (
              <ul className="mb-4 space-y-3">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-(--radius-control) border border-line px-3 py-2">
                    <p className="text-sm whitespace-pre-line text-ink">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {n.authorName ?? ta("admin")} · {formatDate(n.created_at, locale, true)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <NoteForm companyId={company.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
