// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 11F — AdBanner es un servicio, no un elemento visual (renderiza
 * null), así que estos tests comprueban las llamadas reales al SDK, no el
 * DOM. Sin @testing-library/react (su peer @testing-library/dom no está
 * instalado en el proyecto) — mismo patrón mínimo con react-dom/client +
 * act que ya usa src/lib/offline/use-offline-game.test.ts, para no añadir
 * una dependencia nueva solo para esto.
 *
 * Ninguno de estos tests ejecuta el SDK real de AdMob (no puede correr en
 * este entorno) — se verifica que el COMPONENTE llama o NO llama a las
 * funciones del plugin según la política, nunca que "AdMob funciona".
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockPathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockIsNative = true;
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mockIsNative },
}));

const initialize = vi.fn(async () => {});
const showBanner = vi.fn(async (options: Record<string, unknown>) => void options);
const removeBanner = vi.fn(async () => {});
vi.mock("@capacitor-community/admob", () => ({
  AdMob: { initialize, showBanner, removeBanner },
  BannerAdPosition: { BOTTOM_CENTER: "BOTTOM_CENTER" },
  BannerAdSize: { BANNER: "BANNER" },
}));

let mockAdUnitId: string | undefined = "test-ad-unit-id";
vi.mock("@/lib/ads/config", () => ({
  bannerAdUnitId: () => mockAdUnitId,
  isAdMobConfigured: () => Boolean(mockAdUnitId),
}));

const { AdBanner, resetAdMobInitStateForTests } = await import("./ad-banner");

async function mount(props: { adFree: boolean; hasBottomNav: boolean }) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(AdBanner, props));
  });
  return { root, container };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("AdBanner", () => {
  beforeEach(() => {
    mockPathname = "/dashboard";
    mockIsNative = true;
    mockAdUnitId = "test-ad-unit-id";
    initialize.mockClear();
    showBanner.mockClear();
    removeBanner.mockClear();
    resetAdMobInitStateForTests();
  });

  it("1. FREE en ruta permitida + nativo + configurado → inicializa y muestra el banner", async () => {
    const { root, container } = await mount({ adFree: false, hasBottomNav: true });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(showBanner).toHaveBeenCalledTimes(1);
    expect(showBanner.mock.calls[0][0]).toMatchObject({ adId: "test-ad-unit-id" });
    cleanup(root, container);
  });

  it("2. PRO (adFree=true) nunca inicializa ni muestra el banner, aunque la ruta sea elegible", async () => {
    const { root, container } = await mount({ adFree: true, hasBottomNav: true });
    expect(initialize).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    cleanup(root, container);
  });

  it("3. Focus Mode / Jugar nunca muestra el banner, aunque el usuario sea FREE", async () => {
    mockPathname = "/play/abc123";
    const { root, container } = await mount({ adFree: false, hasBottomNav: false });
    expect(initialize).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    cleanup(root, container);
  });

  it("4. ninguna pantalla crítica de Jugar muestra el banner (lobby, nuevo, unirse, resumen, historial)", async () => {
    for (const path of ["/play", "/play/new", "/play/join", "/play/abc/resumen", "/play/historial"]) {
      mockPathname = path;
      const { root, container } = await mount({ adFree: false, hasBottomNav: false });
      expect(showBanner).not.toHaveBeenCalled();
      cleanup(root, container);
    }
  });

  it("5. la decisión depende de la política AD_FREE — no hay una segunda comprobación paralela de plan", async () => {
    // Ruta elegible + FREE real → se muestra; mismo componente, mismo
    // pathname, solo cambia adFree → deja de mostrarse. Un único criterio.
    mockPathname = "/insights";
    const shown = await mount({ adFree: false, hasBottomNav: true });
    expect(showBanner).toHaveBeenCalledTimes(1);
    cleanup(shown.root, shown.container);

    showBanner.mockClear();
    const hidden = await mount({ adFree: true, hasBottomNav: true });
    expect(showBanner).not.toHaveBeenCalled();
    cleanup(hidden.root, hidden.container);
  });

  it("6. no bypass: el componente solo obedece la prop adFree que le pasa el servidor — no hay ningún input del cliente que pueda ocultar el anuncio de un FREE real", async () => {
    // AdBanner no lee cookies/localStorage/query params — su única fuente
    // de la verdad es la prop `adFree`. Con adFree=false (lo que devolvería
    // el servidor para un FREE real) SIEMPRE se muestra en ruta elegible,
    // sin importar nada más que el componente pueda inspeccionar en el DOM.
    document.cookie = "plan=PRO"; // manipulación de cliente, debe ser ignorada
    const { root, container } = await mount({ adFree: false, hasBottomNav: true });
    expect(showBanner).toHaveBeenCalledTimes(1);
    cleanup(root, container);
    document.cookie = "plan=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
  });

  it("7. web (Capacitor.isNativePlatform()=false) nunca llama al SDK nativo — no rompe la app", async () => {
    mockIsNative = false;
    const { root, container } = await mount({ adFree: false, hasBottomNav: true });
    expect(initialize).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    cleanup(root, container);
  });

  it("8. sin Ad Unit ID configurado, la integración queda inerte (nunca llama al SDK)", async () => {
    mockAdUnitId = undefined;
    const { root, container } = await mount({ adFree: false, hasBottomNav: true });
    expect(initialize).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    cleanup(root, container);
  });

  it("9. si AdMob.initialize() falla, el componente no revienta y no llama a showBanner", async () => {
    initialize.mockRejectedValueOnce(new Error("SDK no disponible"));
    let threw = false;
    let root: Root | undefined;
    let container: HTMLElement | undefined;
    try {
      const mounted = await mount({ adFree: false, hasBottomNav: true });
      root = mounted.root;
      container = mounted.container;
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(showBanner).not.toHaveBeenCalled();
    if (root && container) cleanup(root, container);
  });

  it("10. PRO no genera ninguna llamada al SDK publicitario (ni initialize, ni showBanner) — cero coste/tráfico innecesario", async () => {
    const { root, container } = await mount({ adFree: true, hasBottomNav: true });
    expect(initialize).not.toHaveBeenCalled();
    expect(showBanner).not.toHaveBeenCalled();
    expect(removeBanner).not.toHaveBeenCalled();
    cleanup(root, container);
  });

  it("al navegar de una ruta elegible a una no elegible, se retira el banner ya mostrado", async () => {
    const { root, container } = await mount({ adFree: false, hasBottomNav: true });
    expect(showBanner).toHaveBeenCalledTimes(1);

    mockPathname = "/play/abc123";
    await act(async () => {
      root.render(createElement(AdBanner, { adFree: false, hasBottomNav: false }));
    });
    expect(removeBanner).toHaveBeenCalledTimes(1);
    cleanup(root, container);
  });
});
