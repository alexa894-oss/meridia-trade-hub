import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import { endMembership } from "@/lib/admin/actions";
import { loadCategoryOptions, loadFactory } from "@/lib/admin/factories";
import { registerFactoryDocument, removeFactoryDocument, revokeInvitation } from "@/lib/admin/factory-actions";
import { countryName, countryOptions } from "@/lib/countries";
import { localized } from "@/lib/registration/load";
import { Card, formatDate, StatusBadge } from "@/components/admin/ui";
import { FactoryCommercialForm, MembershipForm } from "@/components/admin/factory-commercial";
import { FactoryForm } from "@/components/admin/factory-form";
import { InvitationForm, VerificationsForm } from "@/components/admin/factory-panels";
import { NoteForm } from "@/components/admin/notes-panel";
import { ReviewPanel } from "@/components/admin/review-panel";
import { FormAlert } from "@/components/forms";
import { DocumentUpload } from "@/components/registration/document-upload";

export const instant = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ficha interna de un fabricante de la red.
export default async function FactoryPage({ params, searchParams }: PageProps<"/[locale]/admin/fabricantes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const data = await loadFactory(id);
  if (!data) notFound();
  const locale = await getLocale();
  if ("notFactory" in data) redirect({ href: `/admin/accesos/${id}`, locale });
  if ("notFactory" in data) return null;

  const [t, td, ta, categories] = await Promise.all([
    getTranslations("Admin.factories"),
    getTranslations("Admin.documentKinds"),
    getTranslations("Admin.detail"),
    loadCategoryOptions(),
  ]);
  const { company } = data;
  const f = company.factory_details;
  const c = company.company_contacts;
  const adm = company.factory_admin;
  const hasLicense = data.documents.some((d) => d.kind === "cn_business_license");
  const verifiedOn = (at: string | null | undefined) => (at ? t("verifications.verifiedOn", { date: formatDate(at, locale) }) : null);
  const docsOf = (kind: string) =>
    (company.company_documents ?? []).filter((d) => d.kind === kind).map((d) => ({ id: d.id, fileName: d.file_name }));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/fabricantes" className="text-sm font-semibold text-navy-800 hover:underline">
          ← {t("back")}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">{f?.trade_name ?? f?.legal_name_en ?? t("noName")}</h1>
          <StatusBadge status={company.status} label={t(`status.${company.status}`)} />
          <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-semibold text-navy-800">{t(`account.${data.account}`)}</span>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {f?.legal_name_en} · {countryName(company.country, locale)} · {t("addedOn", { date: formatDate(company.created_at, locale) })}
        </p>
      </div>
      {sp.creada === "1" ? <FormAlert tone="success">{t("createdNotice")}</FormAlert> : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
        <div className="space-y-5">
          <Card title={t("sections.profile")}>
            <FactoryForm
              companyId={company.id}
              countries={countryOptions(locale).map((x) => ({ value: x.code, label: x.name }))}
              categories={categories.map((x) => ({ value: x.id, label: localized(x.names, locale) }))}
              initial={{
                legalName: f?.legal_name_en ?? "",
                tradeName: f?.trade_name ?? "",
                legalNameLocal: f?.legal_name_zh ?? "",
                country: company.country,
                city: f?.city ?? "",
                address: f?.address ?? "",
                registrationNumber: f?.registration_number ?? "",
                website: f?.website ?? "",
                contactName: c?.contact_name ?? "",
                contactTitle: c?.contact_title ?? "",
                email: c?.email ?? "",
                phone: c?.phone ?? "",
                whatsapp: c?.whatsapp ?? "",
                wechat: c?.wechat ?? "",
                products: f?.products ?? "",
                capacity: f?.capacity ?? "",
                moq: f?.moq ?? "",
                departurePort: f?.departure_port ?? "",
                exportMarkets: f?.export_markets ?? "",
                certifications: f?.certifications ?? "",
                commercialTerms: f?.commercial_terms ?? "",
                categoryIds: company.factory_categories.map((fc) => fc.category_id),
              }}
            />
          </Card>

          <Card title={t("sections.documents")}>
            <p className="mb-4 text-sm text-ink-muted">{t("documentsPrivate")}</p>
            {data.documents.length ? (
              <ul className="mb-5 space-y-2">
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
                        {ta("open")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="space-y-5">
              {(["cn_business_license", "brochure", "other"] as const).map((kind) => (
                <DocumentUpload
                  key={kind}
                  companyId={company.id}
                  kind={kind}
                  label={td(kind)}
                  documents={docsOf(kind)}
                  onRegister={registerFactoryDocument}
                  onRemove={removeFactoryDocument}
                />
              ))}
            </div>
          </Card>

          <Card title={ta("sections.history")}>
            {data.history.length ? (
              <ol className="space-y-3">
                {data.history.map((h) => (
                  <li key={h.id} className="border-l-2 border-gold-300 pl-3">
                    <p className="text-sm font-semibold text-navy-800">
                      {h.from_status ? `${t(`status.${h.from_status}` as never)} → ` : ""}
                      {t(`status.${h.to_status}` as never)}
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

        <div className="space-y-5">
          <Card title={t("sections.enable")}>
            <p className="mb-3 text-sm text-ink-muted">{t("enableHint")}</p>
            <ReviewPanel companyId={company.id} kind="factory" status={company.status} currentTier={adm?.tier ?? null} hasLicense={hasLicense} />
          </Card>

          <Card title={t("sections.verifications")}>
            <VerificationsForm
              companyId={company.id}
              checks={[
                { key: "identity", on: !!adm?.identity_verified, detail: verifiedOn(adm?.identity_verified_at) },
                { key: "capacity", on: !!adm?.capacity_verified, detail: verifiedOn(adm?.capacity_verified_at) },
                { key: "history", on: !!adm?.history_verified, detail: verifiedOn(adm?.history_verified_at) },
              ]}
            />
          </Card>

          <Card title={t("sections.invitation")}>
            {data.factoryAccounts.length ? (
              <div className="mb-4 rounded-(--radius-control) border border-success/30 bg-success/5 p-3 text-sm">
                <p className="font-semibold text-navy-800">{t("invitation.active")}</p>
                <ul className="mt-1 text-ink">
                  {data.factoryAccounts.map((a) => (
                    <li key={a.id}>{a.full_name ?? "—"}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {data.pendingInvitation ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-gold-300 bg-gold-100 p-3 text-sm">
                <span>
                  {t("invitation.pending", { email: data.pendingInvitation.email, date: formatDate(data.pendingInvitation.created_at, locale) })}
                </span>
                <form action={revokeInvitation}>
                  <input type="hidden" name="invitationId" value={data.pendingInvitation.id} />
                  <button type="submit" className="font-semibold text-danger hover:underline">
                    {t("invitation.revoke")}
                  </button>
                </form>
              </div>
            ) : null}
            <p className="mb-3 text-sm text-ink-muted">{t("invitation.hint")}</p>
            <InvitationForm companyId={company.id} defaultEmail={c?.email ?? ""} hasPending={!!data.pendingInvitation} />
          </Card>

          <Card title={ta("sections.commercial")}>
            <FactoryCommercialForm companyId={company.id} tier={adm?.tier ?? null} commissionRate={adm?.commission_rate ?? null} notes={adm?.notes ?? null} />
          </Card>

          <Card title={ta("sections.membership")}>
            {data.memberships.length ? (
              <ul className="mb-4 space-y-2">
                {data.memberships.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-(--radius-control) border border-line px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold text-navy-800">{m.membership_plans?.name}</span>
                      <span className="block text-ink-muted">
                        {formatDate(m.starts_at, locale)} → {m.ends_at ? formatDate(m.ends_at, locale) : ta("noEnd")}
                      </span>
                    </span>
                    {!m.ends_at ? (
                      <form action={endMembership}>
                        <input type="hidden" name="membershipId" value={m.id} />
                        <button type="submit" className="text-sm font-semibold text-danger hover:underline">
                          {ta("endMembership")}
                        </button>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            <MembershipForm companyId={company.id} plans={data.plans} />
          </Card>

          <Card title={t("sections.notes")}>
            <p className="mb-3 text-sm text-ink-muted">{t("notesPrivate")}</p>
            {data.notes.length ? (
              <ul className="mb-4 space-y-3">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-(--radius-control) border border-line px-3 py-2">
                    <p className="text-sm whitespace-pre-line text-ink">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {n.authorName ?? "—"} · {formatDate(n.created_at, locale, true)}
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

