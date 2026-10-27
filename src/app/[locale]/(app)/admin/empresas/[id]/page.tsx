import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { endMembership, setFactoryVerification } from "@/lib/admin/actions";
import { loadCompanyForReview } from "@/lib/admin/load";
import { countryName } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { Card, DataList, formatDate, StatusBadge } from "@/components/admin/ui";
import { ReviewPanel } from "@/components/admin/review-panel";
import { FactoryCommercialForm, MembershipForm } from "@/components/admin/factory-commercial";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CompanyReviewPage({ params }: PageProps<"/[locale]/admin/empresas/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const data = await loadCompanyForReview(id);
  if (!data) notFound();
  // Compradores: su expediente está en "Solicitudes de acceso".
  if (data.company.kind === "buyer") redirect({ href: `/admin/accesos/${id}`, locale: await getLocale() });

  const [t, ts, tf, td, locale] = await Promise.all([
    getTranslations("Admin.detail"),
    getTranslations("Admin.status"),
    getTranslations("Registration.fields"),
    getTranslations("Admin.documentKinds"),
    getLocale(),
  ]);
  const { company } = data;
  const buyer = company.buyer_details;
  const factory = company.factory_details;
  const contact = company.company_contacts;
  const admin = company.factory_admin;
  const isFactory = company.kind === "factory";
  const hasLicense = data.documents.some((d) => d.kind === "cn_business_license");

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/empresas" className="text-sm font-semibold text-navy-800 hover:underline">
          ← {t("back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{data.name ?? t("noName")}</h1>
          <StatusBadge status={company.status} label={ts(company.status)} />
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {t(`kind.${isFactory ? "factory" : (buyer?.account_type ?? "company")}`)} · {countryName(company.country, locale)} ·{" "}
          {t("registeredAt", { date: formatDate(company.created_at, locale) })}
          {company.submitted_at ? ` · ${t("submittedAt", { date: formatDate(company.submitted_at, locale, true) })}` : ""}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="space-y-5">
          <Card title={t("sections.data")}>
            {isFactory && factory ? (
              <DataList
                items={[
                  { label: tf("legalNameZh"), value: <span lang="zh-CN">{factory.legal_name_zh}</span> },
                  { label: tf("legalNameEn"), value: factory.legal_name_en },
                  { label: tf("city"), value: factory.city },
                  { label: tf("province"), value: factory.province },
                  {
                    label: tf("categories"),
                    value: company.factory_categories
                      .map((fc) => (fc.categories ? localized(fc.categories.names as Record<string, string>, locale) : ""))
                      .join(", "),
                  },
                  { label: tf("capacity"), value: factory.capacity },
                  { label: tf("departurePort"), value: factory.departure_port },
                  {
                    label: tf("website"),
                    value: factory.website ? (
                      <a href={factory.website} target="_blank" rel="noopener noreferrer" className="text-navy-800 underline">
                        {factory.website}
                      </a>
                    ) : null,
                  },
                  { label: tf("foundedYear"), value: factory.founded_year },
                  { label: tf("annualCapacityOrSales"), value: factory.annual_capacity_or_sales },
                ]}
              />
            ) : buyer ? (
              <DataList
                items={
                  buyer.account_type === "company"
                    ? [
                        { label: tf("legalName"), value: buyer.legal_name },
                        { label: tf("taxId"), value: buyer.tax_id },
                        {
                          label: tf("sector"),
                          value: company.sectors ? localized(company.sectors.names as Record<string, string>, locale) : null,
                        },
                        { label: tf("website"), value: buyer.website },
                      ]
                    : [
                        { label: tf("fullName"), value: buyer.full_name },
                        { label: tf("projectDescription"), value: <span className="whitespace-pre-line">{buyer.project_description}</span> },
                      ]
                }
              />
            ) : (
              <p className="text-ink-muted">{t("incomplete")}</p>
            )}
          </Card>

          <Card title={t("sections.contact")}>
            <p className="mb-4 rounded-(--radius-control) bg-gold-100 px-3 py-2 text-sm text-ink">{t("contactPrivate")}</p>
            {contact ? (
              <DataList
                items={[
                  { label: tf("contactName"), value: contact.contact_name },
                  { label: tf("contactTitle"), value: contact.contact_title },
                  { label: tf("phone"), value: contact.phone },
                  { label: tf("email"), value: contact.email },
                  ...(isFactory ? [{ label: tf("wechat"), value: contact.wechat }] : []),
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
              <p className="text-ink-muted">{t("noDocuments")}</p>
            )}
            {isFactory ? (
              <p className={`mt-3 text-sm ${hasLicense ? "text-success" : "text-ink-muted"}`}>
                {hasLicense ? t("licensePresent") : t("licenseMissing")}
              </p>
            ) : null}
          </Card>

          {isFactory && factory ? (
            <Card title={t("sections.verification")}>
              <p className="mb-3 text-sm text-ink-muted">{t("verificationHint")}</p>
              <form action={setFactoryVerification} className="space-y-3">
                <input type="hidden" name="companyId" value={company.id} />
                <label className="flex items-center gap-3">
                  <input type="checkbox" name="foundedYearVerified" defaultChecked={factory.founded_year_verified} disabled={!factory.founded_year} className="size-5 accent-navy-800" />
                  <span>
                    {tf("foundedYear")}: {factory.founded_year ?? "—"}
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input type="checkbox" name="annualFigureVerified" defaultChecked={factory.annual_figure_verified} disabled={!factory.annual_capacity_or_sales} className="size-5 accent-navy-800" />
                  <span>
                    {tf("annualCapacityOrSales")}: {factory.annual_capacity_or_sales ?? "—"}
                  </span>
                </label>
                <button type="submit" className="min-h-10 rounded-(--radius-control) border border-navy-800 px-4 text-sm font-semibold text-navy-800 hover:bg-navy-50">
                  {t("saveVerification")}
                </button>
              </form>
            </Card>
          ) : null}

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
            <ReviewPanel
              companyId={company.id}
              kind={company.kind}
              status={company.status}
              currentTier={admin?.tier ?? null}
              hasLicense={hasLicense}
            />
          </Card>

          {isFactory ? (
            <>
              <Card title={t("sections.commercial")}>
                <FactoryCommercialForm
                  companyId={company.id}
                  tier={admin?.tier ?? null}
                  commissionRate={admin?.commission_rate ?? null}
                  notes={admin?.notes ?? null}
                />
              </Card>
              <Card title={t("sections.membership")}>
                {data.memberships.length ? (
                  <ul className="mb-4 space-y-2">
                    {data.memberships.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-line px-3 py-2 text-sm">
                        <span>
                          <span className="font-semibold text-navy-800">{m.membership_plans?.name}</span>
                          <span className="block text-ink-muted">
                            {formatDate(m.starts_at, locale)} → {m.ends_at ? formatDate(m.ends_at, locale) : t("noEnd")}
                          </span>
                        </span>
                        {!m.ends_at ? (
                          <form action={endMembership}>
                            <input type="hidden" name="membershipId" value={m.id} />
                            <button type="submit" className="text-sm font-semibold text-danger hover:underline">
                              {t("endMembership")}
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <MembershipForm companyId={company.id} plans={data.plans} />
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
