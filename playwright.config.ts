import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 3000);

/**
 * Uçtan uca testler üretim derlemesine (`npm run build`) karşı çalışır ve
 * seed edilmiş demo kataloğa dayanır. Yerelde yüklü Chrome için:
 *   E2E_BROWSER_CHANNEL=chrome npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "tr-TR",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env["E2E_BROWSER_CHANNEL"]
          ? { channel: process.env["E2E_BROWSER_CHANNEL"] }
          : {}),
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
