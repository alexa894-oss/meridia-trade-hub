import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guard";
import { loadRegistration } from "@/lib/registration/load";
import { deleteRfqDraft } from "@/lib/rfqs/actions";
import { rfqFormOptions, rfqToInitial } from "@/lib/rfqs/form-data";
import { editableRfqStatuses, loadBuyerRfq } from "@/lib/rfqs/load";
import { FormAlert } from "@/components/forms";
import { RfqForm } from "@/components/rfqs/rfq-form";
import { RfqSummary } from "@/components/rfqs/rfq-summary";
import { StatusBadge } from "@/components/admin/ui";
import { loadComparator } from "@/lib/quotes/load";
import { localized } from "@/lib/registration/load";
import { Comparator } from "@/components/quotes/comparator";

export const instant = false;

const KNOWN_ERRORS = ["companyNotValidated", "deadlinePast", "missingFields", "contactInfo", "notEditable", "saveFailed"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BuyerRfqPage({ params, searchParams }: PageProps<"/[locale]/comprador/solicitudes/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const profile = await requireRole("buyer");
  const data = await loadBuyerRfq(id);
  if (!data) notFound();

  const [t, locale, registration] = await Promise.all([getTranslations("Rfq"), getLocale(), loadRegistration(profile)]);
  const { rfq } = data;
  const editable = editableRfqStatuses.includes(rfq.status);
  const showNote = data.note && (rfq.status === "info_requested" || rfq.status === "closed");
  const hasQuotesStage = ["assigned", "quoted", "negotiating", "order_created", "no_response", "closed"].includes(rfq.status);
  const [comparator, tq] = hasQuotesStage ? await Promise.all([loadComparator(rfq.id), getTranslations("Quote")]) : [null, null];
  const unitLabel = rfq.units ? localized(rfq.units.names as Record<string, string>, locale) : "";

  return (
    <div className={`mx-auto space-y-5 ${comparator ? "max-w-5xl" : "max-w-2xl"}`}>
      <Link href="/comprador/solicitudes" className="text-sm font-semibold text-navy-800 hover:underline">
        ← {t("buyer.back")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold text-navy-800 sm:text-3xl">
          #{rfq.number} · {rfq.product}
        </h1>
        <StatusBadge status={rfq.status} label={t(`status.${rfq.status}`)} />
      </div>

      {sp.enviada ? <FormAlert tone="success">{t("buyer.submitted")}</FormAlert> : null}
      {sp.guardada ? <FormAlert tone="success">{t("buyer.saved")}</FormAlert> : null}
      {showNote ? (
        <div role="alert" className="rounded-xl border border-gold-300 bg-gold-100 p-4 text-sm">
          <p className="font-semibold text-navy-800">{t(rfq.status === "closed" ? "buyer.closedNote" : "buyer.infoNote")}</p>
          <p className="mt-1 whitespace-pre-line text-ink">{data.note!.note}</p>
        </div>
      ) : null}
      {!editable ? <p className="text-ink-muted">{t(`buyer.statusHelp.${rfq.status}`)}</p> : null}

      {comparator && tq ? (
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
          <h2 className="mb-4 font-display text-xl font-semibold text-navy-800">{tq("comparator.title", { count: comparator.filter((e) => e.quote.status !== "discarded").length })}</h2>
          <Comparator entries={comparator} incoterms={rfq.incoterms} unitLabel={unitLabel} closed={["closed", "order_created"].includes(rfq.status)} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
        {comparator ? <h2 className="mb-4 font-display text-xl font-semibold text-navy-800">{t("buyer.yourRequest")}</h2> : null}
        {editable ? (
          <RfqForm
            initial={rfqToInitial(rfq, null)}
            {...await rfqFormOptions(locale)}
            canSubmit={registration.company?.status === "validated"}
            initialError={typeof sp.error === "string" && KNOWN_ERRORS.includes(sp.error) ? sp.error : undefined}
          />
        ) : (
          <RfqSummary rfq={rfq} imageUrl={data.imageUrl} />
        )}
      </section>

      {rfq.status === "draft" ? (
        <form action={deleteRfqDraft}>
          <input type="hidden" name="id" value={rfq.id} />
          <button type="submit" className="text-sm font-semibold text-danger hover:underline">
            {t("buyer.deleteDraft")}
          </button>
        </form>
      ) : null}
    </div>
  );
}
