import { expect, test } from "@playwright/test";

// Flujo crítico end-to-end: login (mockeado vía ruta de solo-desarrollo,
// ver src/app/api/dev-login/route.ts) → crear ronda → jugar un hoyo →
// hablar con el coach (red mockeada) → ver resumen.

test.beforeEach(async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto(`/api/dev-login?email=${uniqueEmail}`);
});

test("flujo completo de una ronda", async ({ page }) => {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(/No tienes ninguna ronda en curso/)).toBeVisible();

  await page.getByRole("link", { name: "Nueva ronda" }).click();
  await expect(page).toHaveURL(/\/rondas\/nueva$/);

  await page.getByLabel("Campo").fill("Club de Golf Playwright");
  await page.getByRole("button", { name: "Tranquilo" }).click();
  await page.getByRole("button", { name: "Empezar ronda" }).click();

  await expect(page).toHaveURL(/\/rondas\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Club de Golf Playwright" })).toBeVisible();

  // Jugar el hoyo 1
  await page.getByLabel("Golpes").fill("4");
  await page.getByRole("button", { name: "Guardar hoyo" }).click();
  await expect(page.getByText(/^1\/18/)).toBeVisible();

  // Hablar con el coach: mockeamos la respuesta de red para no depender
  // de una ANTHROPIC_API_KEY real en CI.
  await page.route("**/api/chat", async (route) => {
    const body = JSON.stringify({ type: "token", text: "Respira hondo, un golpe a la vez." }) + "\n" +
      JSON.stringify({ type: "done" }) + "\n";
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body,
    });
  });

  await page.getByRole("button", { name: "Hablar con el coach" }).click();
  await page.getByRole("button", { name: "Estoy nervioso" }).click();
  await expect(page.getByText("Respira hondo, un golpe a la vez.")).toBeVisible();

  await page.keyboard.press("Escape");

  // Finalizar ronda y ver el resumen
  await page.getByRole("button", { name: "Finalizar ronda" }).click();
  await expect(page).toHaveURL(/\/resumen$/);
  await expect(page.getByText("Vs. par")).toBeVisible();
  await expect(page.getByText("4 · Par", { exact: true })).toBeVisible();

  // Aparece en el historial
  await page.getByRole("link", { name: "Ver historial completo" }).click();
  await expect(page).toHaveURL(/\/historial$/);
  await expect(page.getByText("Club de Golf Playwright")).toBeVisible();
});

test("una ruta protegida redirige a la landing si no hay sesión", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Iniciar sesión con Google" })).toBeVisible();
});
