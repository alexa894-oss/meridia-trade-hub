import { ConversationPage } from "@/components/messages/pages";

export const instant = false;

export default async function Page({ params }: PageProps<"/[locale]/fabrica/mensajes/[id]">) {
  const { id } = await params;
  return <ConversationPage role="factory" id={id} />;
}
