import { OrderDetailPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ params, searchParams }: PageProps<"/[locale]/fabrica/pedidos/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return <OrderDetailPage role="factory" id={id} generated={sp.generada === "1"} />;
}
