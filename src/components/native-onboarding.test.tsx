// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dictionaries } from "@/lib/i18n/dictionaries";

/**
 * Login nativo del onboarding. Regresión real encontrada en el simulador de
 * iOS: SocialLogin.login("google") sin GIDClientID (el plugin solo se
 * inicializa en Android) lanza una NSException nativa que cierra la app —
 * ningún try/catch de JS la captura. En iOS nunca debe llamarse; el login va
 * siempre por el navegador in-app (/mobile-login).
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockPlatform = "ios";
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mockPlatform !== "web", getPlatform: () => mockPlatform },
}));
const browserOpen = vi.fn(async (options: { url: string }) => void options);
vi.mock("@capacitor/browser", () => ({ Browser: { open: browserOpen } }));
const socialLogin = vi.fn(async (options: unknown) => {
  void options;
  throw Object.assign(new Error("cancelado"), { code: "USER_CANCELLED" });
});
vi.mock("@capgo/capacitor-social-login", () => ({ SocialLogin: { login: socialLogin } }));
vi.mock("@/actions/auth", () => ({ signInWithGoogle: vi.fn(), signInWithApple: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));

const { NativeOnboarding } = await import("@/components/native-onboarding");

const t = dictionaries.es.onboarding;

describe("NativeOnboarding — login con Google en nativo", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.setItem("mys_onboarded", "1"); // directo a la pantalla de CTA
    browserOpen.mockClear();
    socialLogin.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function clickGoogle() {
    await act(async () => {
      root.render(createElement(NativeOnboarding, { t }));
    });
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === t.continueWithGoogle);
    expect(button).toBeDefined();
    await act(async () => {
      button!.click();
    });
  }

  it("iOS: nunca llama al SDK nativo de Google (cerraría la app) y abre /mobile-login en el navegador in-app", async () => {
    mockPlatform = "ios";
    await clickGoogle();
    expect(socialLogin).not.toHaveBeenCalled();
    expect(browserOpen).toHaveBeenCalledWith({ url: "https://mind-your-swing.vercel.app/mobile-login" });
  });

  it("Android: sigue usando el SDK nativo (Credential Manager)", async () => {
    mockPlatform = "android";
    await clickGoogle();
    expect(socialLogin).toHaveBeenCalledWith({ provider: "google", options: { scopes: ["email", "profile"] } });
    expect(browserOpen).not.toHaveBeenCalled(); // el usuario canceló: no hay fallback
  });
});
