"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field, SelectField } from "@/components/forms";

type Option = { value: string; label: string };

// "Actividad económica": se elige de la lista general (tabla sectors). Con "Otra" se escribe cuál;
// en los demás casos el texto guardado es el nombre de la opción elegida.
export function ActivityField({
  sectors,
  otherId,
  defaultSector,
  defaultActivity,
  sectorError,
  activityError,
}: {
  sectors: Option[];
  otherId: string | undefined;
  defaultSector: string;
  defaultActivity: string;
  sectorError?: string;
  activityError?: string;
}) {
  const t = useTranslations("Registration");
  const tf = useTranslations("Registration.fields");
  const known = sectors.some((s) => s.value === defaultSector);
  const [selected, setSelected] = useState(known ? defaultSector : "");
  const isOther = !!otherId && selected === otherId;
  const label = sectors.find((s) => s.value === selected)?.label ?? "";

  return (
    <>
      <SelectField
        name="sectorId"
        label={tf("economicActivity")}
        placeholder={t("choose")}
        options={sectors}
        defaultValue={known ? defaultSector : ""}
        onChange={(e) => setSelected(e.target.value)}
        error={sectorError}
      />
      {isOther ? (
        <Field
          name="economicActivity"
          label={tf("economicActivityOther")}
          defaultValue={sectors.some((s) => s.label === defaultActivity) ? "" : defaultActivity}
          error={activityError}
        />
      ) : (
        <input type="hidden" name="economicActivity" value={label} />
      )}
    </>
  );
}
