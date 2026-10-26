import { RegistrationPage } from "@/components/registration/registration-page";
import { factorySteps } from "@/lib/registration/steps";

export const instant = false;

export function generateStaticParams() {
  return factorySteps.map((paso) => ({ paso }));
}

export default async function Page({ params }: PageProps<"/[locale]/fabrica/registro/[paso]">) {
  const { paso } = await params;
  return <RegistrationPage role="factory" step={paso} />;
}
