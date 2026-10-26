import { CommissionsPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/admin/comisiones">) {
  const { estado } = await searchParams;
  return <CommissionsPage role="admin" status={typeof estado === "string" ? estado : undefined} />;
}
