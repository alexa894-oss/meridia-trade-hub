export const roles = ["buyer", "factory", "admin"] as const;
export type Role = (typeof roles)[number];

// Inicio de cada rol. La cuenta determina el rol; nadie lo elige al entrar.
export const roleHome: Record<Role, string> = {
  buyer: "/comprador",
  factory: "/fabrica",
  admin: "/admin",
};

// Rutas que exigen sesión (sin prefijo de idioma).
export const protectedPrefixes = ["/panel", "/comprador", "/fabrica", "/admin", "/restablecer", "/notificaciones", "/textos-legales"];

// Rutas solo para visitantes: con sesión se redirige al panel.
export const guestOnlyPrefixes = ["/ingresar", "/solicitar-acceso", "/recuperar"];

export function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Evita redirecciones abiertas: solo rutas internas.
export function safeNextPath(next: unknown, fallback = "/panel") {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : fallback;
}
