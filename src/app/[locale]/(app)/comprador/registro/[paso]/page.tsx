import { RegistrationPage } from "@/components/registration/registration-page";
import { buyerSteps } from "@/lib/registration/steps";

export const instant = false;

export function generateStaticParams() {
  return buyerSteps.map((paso) => ({ paso }));
}

export default async function Page({ params }: PageProps<"/[locale]/comprador/registro/[paso]">) {
  const { paso } = await params;
  return <RegistrationPage role="buyer" step={paso} />;
}
