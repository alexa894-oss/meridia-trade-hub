import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { countryOptions } from "@/lib/countries";
import { editableStatuses, loadOptions, loadRegistration, localized, type RegistrationData } from "@/lib/registration/load";
import { buyerSteps, REQUEST_BASE, type AccountType, type RegistrationStep } from "@/lib/registration/steps";
import { BuyerDetailsForm } from "./buyer-details-form";
import { BuyerProfileForm } from "./buyer-profile-form";
import { ContactForm } from "./contact-form";
import { DocumentUpload } from "./document-upload";
import { SubmitStep } from "./submit-step";

function completion(data: RegistrationData): Record<RegistrationStep, boolean> {
  const b = data.buyer;
  const c = data.contact;
  const isCompany = b?.accountType === "company";
  return {
    datos: !!b,
    contacto: !!c?.whatsapp && (!isCompany || (!!c.city && !!b?.representativeAuthorized)),
    perfil: !!b?.destinationCountry && !!b.purchaseVolume && (data.categoryIds.length > 0 || !!b.otherProducts),
    verificacion: false,
  };
}

// Paso de la solicitud de acceso. Va dentro del <Suspense> del layout del comprador.
export async function RegistrationPage({ step, requestedType }: { step: string; requestedType?: string }) {
  if (!buyerSteps.includes(step as RegistrationStep)) notFound();
  const profile = await requireRole("buyer");
  const [data, options, locale, t] = await Promise.all([
    loadRegistration(profile),
    loadOptions(),
    getLocale(),
    getTranslations("Registration"),
  ]);
  const done = completion(data);
  const editable = !data.company || editableStatuses.includes(data.company.status);
  const currentIndex = buyerSteps.indexOf(step as RegistrationStep);
  // Un paso que necesita los datos del primero no se abre antes.
  const blockedBy = currentIndex > 0 && !data.buyer ? buyerSteps[0] : null;
  const accountType: AccountType | null =
    data.buyer?.accountType ?? (requestedType === "company" || requestedType === "individual" ? requestedType : null);
  const kind = accountType ?? "company";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={REQUEST_BASE} className="text-sm font-semibold text-navy-800 hover:underline">
          ← {t("backToRequest")}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-ink-muted">{t("intro")}</p>
      </div>

      <nav aria-label={t("stepsLabel")}>
        <ol className="flex gap-1.5 overflow-x-auto pb-1">
          {buyerSteps.map((s, i) => {
            const current = s === step;
            return (
              <li key={s} className={current ? "shrink-0 sm:min-w-0 sm:flex-1" : "min-w-10 flex-1"}>
                <Link
                  href={`${REQUEST_BASE}/${s}`}
                  aria-current={current ? "step" : undefined}
                  className={`block rounded-(--radius-control) border px-2 py-2 text-center text-xs font-semibold whitespace-nowrap sm:text-sm ${
                    current
                      ? "border-navy-800 bg-navy-800 text-white"
                      : done[s]
                        ? "border-gold-300 bg-gold-100 text-navy-800"
                        : "border-line bg-surface text-ink-muted"
                  }`}
                >
                  {i + 1}
                  <span className={current ? "" : "sr-only sm:not-sr-only"}>. {t(`steps.${kind}.${s}`)}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      {data.company?.status === "info_requested" && data.latestReview?.message ? (
        <div role="alert" className="rounded-xl border border-gold-300 bg-gold-100 p-4 text-sm">
          <p className="font-semibold text-navy-800">{t("infoRequestedTitle")}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{data.latestReview.message}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        <h2 className="mb-5 font-display text-lg font-semibold text-navy-800">{t(`stepTitles.${kind}.${step}`)}</h2>
        {!editable ? (
          <p className="text-ink">{t(`locked.${data.company!.status}`)}</p>
        ) : blockedBy ? (
          <p className="text-ink">
            {t("completeFirst")}{" "}
            <Link href={`${REQUEST_BASE}/${blockedBy}`} className="font-semibold text-navy-800 underline">
              {t(`steps.${kind}.${blockedBy}`)}
            </Link>
          </p>
        ) : (
          <StepContent step={step as RegistrationStep} data={data} options={options} locale={locale} done={done} accountType={accountType} />
        )}
      </section>
    </div>
  );
}

async function StepContent({
  step,
  data,
  options,
  locale,
  done,
  accountType,
}: {
  step: RegistrationStep;
  data: RegistrationData;
  options: Awaited<ReturnType<typeof loadOptions>>;
  locale: string;
  done: Record<RegistrationStep, boolean>;
  accountType: AccountType | null;
}) {
  const t = await getTranslations("Registration");
  const tf = await getTranslations("Registration.fields");
  const countries = countryOptions(locale).map((c) => ({ value: c.code, label: c.name }));
  const isIndividual = data.buyer?.accountType === "individual";
  const b = data.buyer;

  switch (step) {
    case "datos":
      return (
        <BuyerDetailsForm
          allowIndividual={data.allowIndividualBuyers}
          countries={countries}
          sectors={options.sectors.map((s) => ({ value: s.id, label: localized(s.names, locale) }))}
          otherSectorId={options.sectors.find((s) => s.slug === "other")?.id}
          initial={{
            accountType,
            country: data.company?.country ?? null,
            legalName: b?.legalName ?? null,
            tradeName: b?.tradeName ?? null,
            taxId: b?.taxId ?? null,
            economicActivity: b?.economicActivity ?? null,
            sectorId: data.company?.sectorId ?? null,
            website: b?.website ?? null,
            fullName: b?.fullName ?? null,
            idType: b?.idType ?? null,
            idNumber: b?.idNumber ?? null,
          }}
        />
      );
    case "contacto":
      return (
        <ContactForm
          isIndividual={isIndividual}
          countries={countries}
          initial={{
            contactName: data.contact?.name ?? null,
            contactTitle: data.contact?.title ?? null,
            email: data.contact?.email ?? null,
            whatsapp: data.contact?.whatsapp ?? null,
            contactCountry: data.contact?.country ?? data.company?.country ?? null,
            city: data.contact?.city ?? null,
            authorized: b?.representativeAuthorized ?? false,
          }}
        />
      );
    case "perfil":
      return (
        <BuyerProfileForm
          isIndividual={isIndividual}
          countries={countries}
          categories={options.categories.map((c) => ({ value: c.id, label: localized(c.names, locale) }))}
          initial={{
            companyType: b?.companyType ?? null,
            categoryIds: data.categoryIds,
            destinationCountry: b?.destinationCountry ?? null,
            purchaseVolume: b?.purchaseVolume ?? null,
            purchasePurpose: b?.purchasePurpose ?? null,
            needsDescription: b?.needsDescription ?? null,
            otherProducts: b?.otherProducts ?? null,
          }}
        />
      );
    case "verificacion": {
      const companyId = data.company?.id ?? "";
      const docsOf = (kind: string) =>
        data.documents.filter((d) => d.kind === kind).map((d) => ({ id: d.id, fileName: d.fileName }));
      const slots = isIndividual
        ? [{ kind: "id_document" as const, label: tf("idDocument"), hint: t("hints.idDocument") }]
        : [
            { kind: "tax_registration" as const, label: tf("commercialRegistration"), hint: t("hints.commercialRegistration") },
            { kind: "representation" as const, label: tf("representationDocument"), hint: t("hints.representationDocument") },
          ];
      return (
        <div className="space-y-6">
          {isIndividual ? (
            <p role="note" className="rounded-(--radius-control) border border-gold-300 bg-gold-100 px-4 py-3 text-sm text-ink">
              {t("individualNotice")}
            </p>
          ) : null}
          <p className="rounded-(--radius-control) bg-navy-50 px-4 py-3 text-sm text-ink">{t("documentsNote")}</p>
          {slots.map((slot) => (
            <DocumentUpload
              key={slot.kind}
              companyId={companyId}
              kind={slot.kind}
              label={`${slot.label} · ${t("whenApplicable")}`}
              hint={slot.hint}
              documents={docsOf(slot.kind)}
            />
          ))}
          <SubmitStep
            acceptedIds={data.acceptedLegalIds}
            legalDocuments={data.legalDocuments.map((d) => ({
              id: d.id,
              kind: d.kind,
              version: d.version,
              isDraft: d.isDraft,
              text: localized(d.content, locale),
            }))}
            summary={buyerSteps
              .filter((s) => s !== "verificacion")
              .map((s) => ({ label: t(`steps.${isIndividual ? "individual" : "company"}.${s}`), done: done[s] }))}
          />
        </div>
      );
    }
  }
}
