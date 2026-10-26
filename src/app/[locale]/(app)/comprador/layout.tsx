import { Suspense, type ReactNode } from "react";
import { RoleGate } from "@/lib/auth/guard";
import { PageLoading } from "@/components/page-loading";

// Solo cuentas con rol "buyer". Otro rol vuelve a su propio panel.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoleGate allow="buyer">{children}</RoleGate>
    </Suspense>
  );
}
