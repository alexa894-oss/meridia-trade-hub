import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/lib/auth/guard";
import { PageLoading } from "@/components/page-loading";
import { SectionNav } from "@/components/section-nav";

// Solo cuentas con rol "factory". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="factory">
        <SectionNav
          namespace="Nav.factory"
          items={[
            { href: "/fabrica", key: "home", exact: true },
            { href: "/fabrica/oportunidades", key: "opportunities" },
            { href: "/fabrica/pedidos", key: "orders" },
            { href: "/fabrica/comisiones", key: "commissions" },
            { href: "/fabrica/mensajes", key: "messages" },
          ]}
        />
        {children}
      </RoleGate>
    </Suspense>
  );
}
