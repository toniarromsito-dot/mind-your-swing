import { expect, test } from "@playwright/test";

// Flujo crítico end-to-end: login (mockeado vía ruta de solo-desarrollo,
// ver src/app/api/dev-login/route.ts) → crear partida en solitario → lobby
// → Focus Mode (cuadrícula de golpes, toque = guardado automático, hoyo a
// hoyo) → resumen → aparece en el historial de /play.

test.beforeEach(async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await page.goto(`/api/dev-login?email=${uniqueEmail}`);
});

test("flujo completo de una partida en solitario", async ({ page }) => {
  // 18 hoyos con la breve pausa de confirmación (~1.1s) de la cuadrícula
  // de golpes superan el timeout por defecto de 30s.
  test.setTimeout(75_000);

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("¿Qué quieres hacer hoy?")).toBeVisible();

  await page.goto("/play/new");
  await page.getByRole("button", { name: "Prefiero jugar solo" }).click();

  await page.getByPlaceholder("Busca un campo…").fill("Son Muntaner");
  await page.getByRole("button", { name: /Son Muntaner/ }).click();

  await page.getByRole("button", { name: "Crear partida" }).click();

  // Aterriza en el lobby (started=false), no directamente en el scorecard.
  await expect(page).toHaveURL(/\/play\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: "Son Muntaner" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Empezar partida" })).toBeVisible();

  await page.getByRole("button", { name: "Empezar partida" }).click();

  // Focus Mode: nada más que la cuadrícula de golpes, hoyo a hoyo hasta el
  // 18 — tocar un número guarda al instante y avanza solo, sin botones.
  for (let holeNumber = 1; holeNumber <= 18; holeNumber++) {
    await expect(page.getByRole("heading", { name: `Hoyo ${holeNumber}` })).toBeVisible();
    await page.getByRole("button", { name: "4", exact: true }).click();
  }

  // Finalizar la última anota-y-guarda dispara finishGame + navegación al
  // resumen. Margen generoso: en dev, Turbopack compila /resumen la
  // primera vez que se visita (varios segundos).
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
