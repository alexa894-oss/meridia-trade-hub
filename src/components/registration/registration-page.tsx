import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { countryOptions } from "@/lib/countries";
import { editableStatuses, loadOptions, loadRegistration, localized, type RegistrationData } from "@/lib/registration/load";
import { registrationBase, stepsFor, type RegistrationStep } from "@/lib/registration/steps";
import { BuyerDetailsForm } from "./buyer-details-form";
import { ContactForm } from "./contact-form";
import { DocumentsStep } from "./documents-step";
import { FactoryCompanyForm } from "./factory-company-form";
import { FactoryProductionForm } from "./factory-production-form";
import { SubmitStep } from "./submit-step";

type Party = "buyer" | "factory";

function completion(role: Party, data: RegistrationData): Record<string, boolean> {
  const docs = (kind: string) => data.documents.filter((d) => d.kind === kind);
  if (role === "buyer") {
    const requiredKind = data.buyer?.accountType === "individual" ? "id_document" : "tax_registration";
    return {
      datos: !!data.buyer,
      contacto: !!data.contact,
      documento: !!data.buyer && docs(requiredKind).length > 0,
    };
  }
  const f = data.factory;
  const production = !!f && !!f.capacity && !!f.departurePort && data.categoryIds.length > 0 && (!!f.website || docs("brochure").length > 0);
  return {
    empresa: !!f,
    contacto: !!data.contact?.wechat,
    produccion: production,
    documentos: production, // opcional: el registro empresarial chino se exige al validar como estándar
  };
}

// Paso del registro de la empresa. Va dentro del <Suspense> del layout del rol.
export async function RegistrationPage({ role, step }: { role: Party; step: string }) {
  const steps = stepsFor(role);
  if (!steps.includes(step as RegistrationStep)) notFound();
  const profile = await requireRole(role);
  const [data, options, locale, t] = await Promise.all([
    loadRegistration(profile),
    loadOptions(),
    getLocale(),
    getTranslations("Registration"),
  ]);
  const base = registrationBase(role);
  const done = completion(role, data);
  const editable = !data.company || editableStatuses.includes(data.company.status);
  const currentIndex = steps.indexOf(step as RegistrationStep);
  // Un paso que necesita la empresa no se abre antes del primero.
  const blockedBy = currentIndex > 0 && !data.company ? steps[0] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={role === "buyer" ? "/comprador" : "/fabrica"} className="text-sm font-semibold text-navy-800 hover:underline">
          ← {t("backToPanel")}
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold text-navy-800 sm:text-3xl">{t(`title.${role}`)}</h1>
        <p className="mt-1 text-ink-muted">{t(`intro.${role}`)}</p>
      </div>

      <nav aria-label={t("stepsLabel")}>
        <ol className="flex gap-1.5 overflow-x-auto pb-1">
          {steps.map((s, i) => {
            const current = s === step;
            return (
              <li key={s} className={current ? "shrink-0 sm:min-w-0 sm:flex-1" : "min-w-10 flex-1"}>
                <Link
                  href={`${base}/${s}`}
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
                  <span className={current ? "" : "sr-only sm:not-sr-only"}>. {t(`steps.${s}`)}</span>
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
        {!editable ? (
          <p className="text-ink">{t(`locked.${data.company!.status}`)}</p>
        ) : blockedBy ? (
          <p className="text-ink">
            {t("completeFirst")}{" "}
            <Link href={`${base}/${blockedBy}`} className="font-semibold text-navy-800 underline">
              {t(`steps.${blockedBy}`)}
            </Link>
          </p>
        ) : (
          <StepContent role={role} step={step as RegistrationStep} data={data} options={options} locale={locale} done={done} />
        )}
      </section>
    </div>
  );
}

async function StepContent({
  role,
  step,
  data,
  options,
  locale,
  done,
}: {
  role: Party;
  step: RegistrationStep;
  data: RegistrationData;
  options: Awaited<ReturnType<typeof loadOptions>>;
  locale: string;
  done: Record<string, boolean>;
}) {
  const t = await getTranslations("Registration");
  const tf = await getTranslations("Registration.fields");
  const docsOf = (kind: string) =>
    data.documents.filter((d) => d.kind === kind).map((d) => ({ id: d.id, fileName: d.fileName }));
  const companyId = data.company?.id ?? "";

  switch (step) {
    case "datos":
      return (
        <BuyerDetailsForm
          allowIndividual={data.allowIndividualBuyers}
          countries={countryOptions(locale).map((c) => ({ value: c.code, label: c.name }))}
          sectors={options.sectors.map((s) => ({ value: s.id, label: localized(s.names, locale) }))}
          initial={{
            accountType: data.buyer?.accountType ?? null,
            country: data.company?.country ?? null,
            legalName: data.buyer?.legalName ?? null,
            taxId: data.buyer?.taxId ?? null,
            sectorId: data.company?.sectorId ?? null,
            website: data.buyer?.website ?? null,
            fullName: data.buyer?.fullName ?? null,
            projectDescription: data.buyer?.projectDescription ?? null,
          }}
        />
      );
    case "empresa":
      return (
        <FactoryCompanyForm
          initial={{
            legalNameZh: data.factory?.legalNameZh ?? null,
            legalNameEn: data.factory?.legalNameEn ?? null,
            city: data.factory?.city ?? null,
            province: data.factory?.province ?? null,
          }}
        />
      );
    case "contacto":
      return (
        <ContactForm
          role={role}
          isIndividual={data.buyer?.accountType === "individual"}
          initial={{
            contactName: data.contact?.name ?? null,
            contactTitle: data.contact?.title ?? null,
            phone: data.contact?.phone ?? null,
            email: data.contact?.email ?? null,
            wechat: data.contact?.wechat ?? null,
          }}
        />
      );
    case "produccion":
      return (
        <FactoryProductionForm
          companyId={companyId}
          brochures={docsOf("brochure")}
          categories={options.categories.map((c) => ({ value: c.id, label: localized(c.names, locale) }))}
          initial={{
            categoryIds: data.categoryIds,
            capacity: data.factory?.capacity ?? null,
            departurePort: data.factory?.departurePort ?? null,
            website: data.factory?.website ?? null,
            foundedYear: data.factory?.foundedYear ?? null,
            annualCapacityOrSales: data.factory?.annualCapacityOrSales ?? null,
          }}
        />
      );
    case "documento": {
      const individual = data.buyer?.accountType === "individual";
      const kind = individual ? "id_document" : "tax_registration";
      return (
        <DocumentsStep
          role="buyer"
          companyId={companyId}
          slots={[
            {
              kind,
              label: tf(individual ? "idDocument" : "verificationDocument"),
              hint: t(individual ? "hints.idDocument" : "hints.verificationDocument"),
              required: true,
              documents: docsOf(kind),
            },
          ]}
        />
      );
    }
    case "documentos":
      return (
        <DocumentsStep
          role="factory"
          companyId={companyId}
          slots={[
            {
              kind: "cn_business_license",
              label: tf("businessLicense"),
              hint: t("hints.businessLicense"),
              required: false,
              documents: docsOf("cn_business_license"),
            },
          ]}
        />
      );
    case "enviar":
      return (
        <SubmitStep
          role={role}
          acceptedIds={data.acceptedLegalIds}
          legalDocuments={data.legalDocuments.map((d) => ({
            id: d.id,
            kind: d.kind,
            version: d.version,
            isDraft: d.isDraft,
            text: localized(d.content, locale),
          }))}
          summary={stepsFor(role)
            .filter((s) => s !== "enviar")
            .map((s) => ({ label: t(`steps.${s}`), done: !!done[s] }))}
        />
      );
  }
}
