import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/lib/auth/guard";
import { PageLoading } from "@/components/page-loading";
import { SectionNav } from "@/components/section-nav";

// Solo cuentas con rol "buyer". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="buyer">
        <SectionNav
          namespace="Nav.buyer"
          items={[
            { href: "/comprador", key: "home", exact: true },
            { href: "/comprador/solicitudes", key: "rfqs" },
            { href: "/comprador/mensajes", key: "messages" },
          ]}
        />
        {children}
      </RoleGate>
    </Suspense>
  );
}
