import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export const instant = false;

export default async function Page() {
  redirect({ href: "/comprador/registro/datos", locale: await getLocale() });
}
