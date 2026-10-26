import { OrderDetailPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ params, searchParams }: PageProps<"/[locale]/admin/pedidos/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <OrderDetailPage role="admin" id={id} generated={sp.generada === "1"} />;
}
