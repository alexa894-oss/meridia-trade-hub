import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/lib/auth/guard";
import { PageLoading } from "@/components/page-loading";
import { AdminNav } from "@/components/admin/admin-nav";

// Solo cuentas con rol "admin". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="admin">
        <AdminNav />
        {children}
      </RoleGate>
    </Suspense>
  );
}
