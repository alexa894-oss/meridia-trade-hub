import { CommissionsPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/fabrica/comisiones">) {
  const { estado } = await searchParams;
  return <CommissionsPage role="factory" status={typeof estado === "string" ? estado : undefined} />;
}
