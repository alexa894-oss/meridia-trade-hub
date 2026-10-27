import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

// Dirección anterior: el registro público ahora es "Solicitar acceso".
export default async function Page() {
  redirect({ href: "/solicitar-acceso", locale: await getLocale() });
}
