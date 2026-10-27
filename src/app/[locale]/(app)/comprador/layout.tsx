import { Suspense, type ReactNode } from "react";
import { RoleGate, requireRole } from "@/lib/auth/guard";
import { loadCompanyStatus } from "@/lib/registration/load";
import { PageLoading } from "@/components/page-loading";
import { SectionNav } from "@/components/section-nav";

// Solo cuentas con rol "buyer". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="buyer">
        <BuyerNav />
        {children}
      </RoleGate>
    </Suspense>
  );
}

// Mientras la solicitud no esté aprobada, solo se ve el seguimiento.
async function BuyerNav() {
  const profile = await requireRole("buyer");
  const approved = (await loadCompanyStatus(profile.companyId)) === "validated";
  return (
    <SectionNav
      namespace="Nav.buyer"
      items={
        approved
          ? [
              { href: "/comprador", key: "home", exact: true },
              { href: "/comprador/solicitudes", key: "rfqs" },
              { href: "/comprador/pedidos", key: "orders" },
              { href: "/comprador/mensajes", key: "messages" },
              { href: "/comprador/solicitud", key: "access" },
            ]
          : [
              { href: "/comprador", key: "home", exact: true },
              { href: "/comprador/solicitud", key: "access" },
            ]
      }
    />
  );
}
