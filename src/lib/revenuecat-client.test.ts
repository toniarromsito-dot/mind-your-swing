import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fase 12C — wrapper del SDK de RevenueCat. Ninguno de estos tests ejecuta
 * el SDK real (no puede correr en este entorno) — verifican que el WRAPPER
 * llama o NO llama al plugin nativo según la plataforma/configuración,
 * nunca que "RevenueCat funciona".
 */

let mockIsNative = true;
let mockPlatform = "android";
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockIsNative,
    getPlatform: () => mockPlatform,
  },
}));

const configure = vi.fn(async (options: Record<string, unknown>) => void options);
const logIn = vi.fn(async (options: Record<string, unknown>) => { void options; return { customerInfo: {} }; });
const logOut = vi.fn(async () => ({ customerInfo: {} }));
const getCustomerInfo = vi.fn(async () => ({ customerInfo: { entitlements: {} } }));
const getOfferings = vi.fn(async () => ({ current: null, all: {} }));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: { configure, logIn, logOut, getCustomerInfo, getOfferings },
}));

const {
  configureAndLoginRevenueCat,
  logoutRevenueCat,
  getRevenueCatCustomerInfo,
  getRevenueCatOfferings,
  isRevenueCatClientConfigured,
  resetRevenueCatClientStateForTests,
} = await import("./revenuecat-client");

describe("revenuecat-client", () => {
  const ORIGINAL_ANDROID = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID;
  const ORIGINAL_IOS = process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS;

  beforeEach(() => {
    mockIsNative = true;
    mockPlatform = "android";
    process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID = "test-android-key";
    process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS = "test-ios-key";
    configure.mockClear();
    logIn.mockClear();
    logOut.mockClear();
    getCustomerInfo.mockClear();
    getOfferings.mockClear();
    resetRevenueCatClientStateForTests();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID = ORIGINAL_ANDROID;
    process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS = ORIGINAL_IOS;
  });

  it("1. web (isNativePlatform=false) nunca llama al SDK — no rompe la app", async () => {
    mockIsNative = false;
    await configureAndLoginRevenueCat("user-1");
    expect(configure).not.toHaveBeenCalled();
    expect(logIn).not.toHaveBeenCalled();
  });

  it("2. sin API key para la plataforma actual, la integración queda inerte", async () => {
    delete process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID;
    await configureAndLoginRevenueCat("user-1");
    expect(configure).not.toHaveBeenCalled();
  });

  it("3. primera llamada nativa con API key real → configure() con el appUserId real (nunca anónimo, nunca email)", async () => {
    await configureAndLoginRevenueCat("cuid_user_123");
    expect(configure).toHaveBeenCalledTimes(1);
    expect(configure.mock.calls[0][0]).toMatchObject({ apiKey: "test-android-key", appUserID: "cuid_user_123" });
    expect(logIn).not.toHaveBeenCalled();
  });

  it("9. si el SDK falla al configurar, no revienta (fire-and-forget con log)", async () => {
    configure.mockRejectedValueOnce(new Error("SDK no disponible"));
    await expect(configureAndLoginRevenueCat("user-1")).resolves.toBeUndefined();
  });

  it("logout en web/no-nativo no llama a Purchases.logOut()", async () => {
    mockIsNative = false;
    await logoutRevenueCat();
    expect(logOut).not.toHaveBeenCalled();
  });

  it("getCustomerInfo en web devuelve null sin llamar al SDK (nunca se usa como autorización de todos modos)", async () => {
    mockIsNative = false;
    const info = await getRevenueCatCustomerInfo();
    expect(info).toBeNull();
    expect(getCustomerInfo).not.toHaveBeenCalled();
  });

  it("getOfferings en web devuelve null sin llamar al SDK", async () => {
    mockIsNative = false;
    const offerings = await getRevenueCatOfferings();
    expect(offerings).toBeNull();
    expect(getOfferings).not.toHaveBeenCalled();
  });

  it("iOS usa la API key de iOS, nunca la de Android", async () => {
    mockPlatform = "ios";
    await configureAndLoginRevenueCat("user-ios");
    expect(configure.mock.calls[0][0]).toMatchObject({ apiKey: "test-ios-key" });
  });

  it("segunda identificación (otro usuario en el mismo dispositivo) usa logIn(), nunca vuelve a llamar configure() ni mezcla el customer anterior", async () => {
    await configureAndLoginRevenueCat("user-a");
    expect(configure).toHaveBeenCalledTimes(1);

    await configureAndLoginRevenueCat("user-b");
    expect(configure).toHaveBeenCalledTimes(1); // no se reconfigura
    expect(logIn).toHaveBeenCalledTimes(1);
    expect(logIn.mock.calls[0][0]).toMatchObject({ appUserID: "user-b" });
  });

  it("isRevenueCatClientConfigured refleja si hay API key para la plataforma actual", () => {
    mockPlatform = "android";
    expect(isRevenueCatClientConfigured()).toBe(true);
    delete process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID;
    expect(isRevenueCatClientConfigured()).toBe(false);
  });
});
