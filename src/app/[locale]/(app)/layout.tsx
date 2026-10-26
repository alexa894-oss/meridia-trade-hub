import { setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/app-header";

// Todo lo que cuelga de aquí depende de la sesión del usuario: no hay
// contenido común que prerenderizar, así que la navegación puede esperar al servidor.
export const instant = false;

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <AppHeader />
      <main className="flex-1 bg-surface-muted">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
      </main>
    </>
  );
}
