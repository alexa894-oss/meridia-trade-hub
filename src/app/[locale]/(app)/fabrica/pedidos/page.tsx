import { OrdersListPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/fabrica/pedidos">) {
  const { estado } = await searchParams;
  return <OrdersListPage role="factory" status={typeof estado === "string" ? estado : undefined} />;
}
