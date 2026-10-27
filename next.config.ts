import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Dirección anterior: el registro público ahora es "Solicitar acceso".
  async redirects() {
    return [
      { source: "/crear-cuenta", destination: "/solicitar-acceso", permanent: true },
      { source: "/:locale/crear-cuenta", destination: "/:locale/solicitar-acceso", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
