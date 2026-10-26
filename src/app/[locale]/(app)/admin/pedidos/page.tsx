import { OrdersListPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/admin/pedidos">) {
  const { estado } = await searchParams;
  return <OrdersListPage role="admin" status={typeof estado === "string" ? estado : undefined} />;
}
