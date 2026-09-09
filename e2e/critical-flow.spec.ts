import { expect, test } from "@playwright/test";

// Flujo crítico end-to-end: login (mockeado vía ruta de solo-desarrollo,
// ver src/app/api/dev-login/route.ts) → crear partida en solitario → jugar
// un hoyo → hablar con el compañero (red mockeada) → finalizar → resumen
// → aparece en el historial de /play.

test.beforeEach(async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto(`/api/dev-login?email=${uniqueEmail}`);
});

test("flujo completo de una partida en solitario", async ({ page }) => {
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("¿Qué quieres hacer hoy?")).toBeVisible();

  await page.goto("/play/new");
  await page.getByRole("button", { name: "Prefiero jugar solo" }).click();

  await page.getByPlaceholder("Busca un campo…").fill("Son Muntaner");
  await page.getByRole("button", { name: /Son Muntaner/ }).click();

  await page.getByRole("button", { name: "Crear partida" }).click();

  await expect(page).toHaveURL(/\/play\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Son Muntaner" })).toBeVisible();

  // Jugar el hoyo 1 (par 4): sube el contador de golpes a 4.
  const addStroke = page.getByRole("button", { name: "Sumar a Golpes" });
  for (let i = 0; i < 4; i++) await addStroke.click();
  await expect(page.getByText("Par", { exact: true })).toBeVisible();

  // Hablar con el compañero: mockeamos la respuesta de red para no depender
  // de una ANTHROPIC_API_KEY real en CI.
  await page.route("**/api/chat", async (route) => {
    const body =
      JSON.stringify({ type: "token", text: "Respira hondo, un golpe a la vez." }) + "\n" +
      JSON.stringify({ type: "done" }) + "\n";
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson; charset=utf-8",
      body,
    });
  });

  await page.getByRole("button", { name: "Hablar con mi compañero" }).click();
  await page.getByRole("button", { name: "Estoy nervioso" }).click();
  await expect(page.getByText("Respira hondo, un golpe a la vez.")).toBeVisible();

  await page.keyboard.press("Escape");

  // Finalizar partida y ver el resumen. Margen generoso: en dev, Turbopack
  // compila la ruta /resumen la primera vez que se visita (varios segundos).
  await page.getByRole("button", { name: "Finalizar partida" }).click();
  await expect(page).toHaveURL(/\/resumen$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Son Muntaner" })).toBeVisible();

  // Aparece en el historial de /play
  await page.getByRole("link", { name: "Ver historial completo" }).click();
  await expect(page).toHaveURL(/\/play$/);
  await page.getByRole("tab", { name: "Historial" }).click();
  await expect(page.getByText("Son Muntaner")).toBeVisible();
});

test("una ruta protegida redirige a la landing si no hay sesión", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Empezar gratis" }).first()).toBeVisible();
});
