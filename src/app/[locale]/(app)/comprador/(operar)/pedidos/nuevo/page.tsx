import { NewOrderPage } from "@/components/orders/pages";

export const instant = false;

export default async function Page({ searchParams }: PageProps<"/[locale]/comprador/pedidos/nuevo">) {
  const { cotizacion } = await searchParams;
  return <NewOrderPage quoteId={typeof cotizacion === "string" ? cotizacion : undefined} />;
}
