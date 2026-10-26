import { defineRouting } from "next-intl/routing";

// Todos los idiomas previstos. zh-CN tiene la estructura lista pero aún no está traducido.
export const plannedLocales = ["es", "zh-CN"] as const;
export type PlannedLocale = (typeof plannedLocales)[number];

// Idiomas activos. Para publicar chino: completar messages/zh-CN.json
// (npm run i18n:check debe salir sin faltantes) y añadir "zh-CN" aquí.
export const routing = defineRouting({
  locales: ["es"] satisfies PlannedLocale[],
  defaultLocale: "es",
  localePrefix: "as-needed",
});
