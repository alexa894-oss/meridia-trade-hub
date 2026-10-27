import { Suspense, type ReactNode } from "react";
import { RoleGate, requireRole } from "@/lib/auth/guard";
import { loadCompanyStatus } from "@/lib/registration/load";
import { PageLoading } from "@/components/page-loading";
import { SectionNav } from "@/components/section-nav";

// Solo cuentas con rol "factory". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="factory">
        <FactoryNav />
        {children}
      </RoleGate>
    </Suspense>
  );
}

// Mientras Meridia no la habilite, la fábrica solo ve su inicio.
async function FactoryNav() {
  const profile = await requireRole("factory");
  const enabled = (await loadCompanyStatus(profile.companyId)) === "validated";
  return (
    <SectionNav
      namespace="Nav.factory"
      items={
        enabled
          ? [
              { href: "/fabrica", key: "home", exact: true },
              { href: "/fabrica/oportunidades", key: "opportunities" },
              { href: "/fabrica/pedidos", key: "orders" },
              { href: "/fabrica/comisiones", key: "commissions" },
              { href: "/fabrica/mensajes", key: "messages" },
            ]
          : [{ href: "/fabrica", key: "home", exact: true }]
      }
    />
  );
}
