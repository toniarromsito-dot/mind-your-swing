import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5544/mindyourswing_test",
      // Los e2e mockean /api/chat a nivel de red (page.route); nunca deben
      // depender de una llamada real a Anthropic (lento, flaky, cuesta
      // dinero). Forzamos la key vacía aunque el .env local tenga una real.
      ANTHROPIC_API_KEY: "",
    },
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
