import { RegistrationPage } from "@/components/registration/registration-page";
import { buyerSteps } from "@/lib/registration/steps";

export const instant = false;

export function generateStaticParams() {
  return buyerSteps.map((paso) => ({ paso }));
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/comprador/solicitud/[paso]">) {
  const [{ paso }, sp] = await Promise.all([params, searchParams]);
  return <RegistrationPage step={paso} requestedType={typeof sp.tipo === "string" ? sp.tipo : undefined} />;
}
