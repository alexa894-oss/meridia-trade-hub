import { RoleHome } from "@/components/role-home";

// Depende de la sesión; ver (app)/layout.tsx.
export const instant = false;

export default function Page() {
  return <RoleHome role="factory" />;
}
