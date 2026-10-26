import { SectionNav } from "@/components/section-nav";

export function AdminNav() {
  return (
    <SectionNav
      namespace="Admin.nav"
      items={[
        { href: "/admin", key: "dashboard", exact: true },
        { href: "/admin/empresas", key: "companies" },
        { href: "/admin/solicitudes", key: "rfqs" },
        { href: "/admin/mensajes", key: "messages" },
        { href: "/admin/planes", key: "plans" },
        { href: "/admin/configuracion", key: "settings" },
      ]}
    />
  );
}
