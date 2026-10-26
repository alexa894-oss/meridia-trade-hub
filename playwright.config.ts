import fs from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Claves públicas de Supabase y SEED_PASSWORD para las pruebas.
for (const file of [".env.local", ".env.test.local"]) if (fs.existsSync(file)) process.loadEnvFile(file);

// Pruebas de punta a punta contra la app local y la base de DESARROLLO con los
// datos de prueba cargados (npm run seed). Ver README → Pruebas.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3456";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", locale: "es-PA" },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "celular", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" }, testMatch: /mobile\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npx next dev -p 3456", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
