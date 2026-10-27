import { OrdersListPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/comprador/pedidos">) {
  const { estado } = await searchParams;
  return <OrdersListPage role="buyer" status={typeof estado === "string" ? estado : undefined} />;
}
