import { ConversationPage } from "@/components/messages/pages";

export const instant = false;

export default async function Page({ params }: PageProps<"/[locale]/admin/mensajes/[id]">) {
  const { id } = await params;
  return <ConversationPage role="admin" id={id} />;
}
