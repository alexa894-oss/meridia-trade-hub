import { ConversationPage } from "@/components/messages/pages";

export const instant = false;

export default async function Page({ params }: PageProps<"/[locale]/comprador/mensajes/[id]">) {
  const { id } = await params;
  return <ConversationPage role="buyer" id={id} />;
}
