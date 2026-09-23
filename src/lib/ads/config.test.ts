import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockPlatform = "web";
vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => mockPlatform },
}));

const { bannerAdUnitId, isAdMobConfigured } = await import("./config");

describe("ads/config", () => {
  const ORIGINAL_ANDROID = process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID;
  const ORIGINAL_IOS = process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS;

  beforeEach(() => {
    mockPlatform = "web";
    delete process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID;
    delete process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS;
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID = ORIGINAL_ANDROID;
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS = ORIGINAL_IOS;
  });

  it("sin ninguna variable configurada, no hay ad unit id en ninguna plataforma", () => {
    mockPlatform = "android";
    expect(bannerAdUnitId()).toBeUndefined();
    expect(isAdMobConfigured()).toBe(false);

    mockPlatform = "ios";
    expect(bannerAdUnitId()).toBeUndefined();
    expect(isAdMobConfigured()).toBe(false);
  });

  it("web nunca resuelve un ad unit id, aunque las variables estén configuradas", () => {
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID = "android-unit";
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS = "ios-unit";
    mockPlatform = "web";
    expect(bannerAdUnitId()).toBeUndefined();
    expect(isAdMobConfigured()).toBe(false);
  });

  it("android usa NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID, nunca el de iOS", () => {
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID = "android-unit";
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS = "ios-unit";
    mockPlatform = "android";
    expect(bannerAdUnitId()).toBe("android-unit");
    expect(isAdMobConfigured()).toBe(true);
  });

  it("iOS usa NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS, nunca el de Android", () => {
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_ANDROID = "android-unit";
    process.env.NEXT_PUBLIC_ADMOB_BANNER_AD_UNIT_ID_IOS = "ios-unit";
    mockPlatform = "ios";
    expect(bannerAdUnitId()).toBe("ios-unit");
    expect(isAdMobConfigured()).toBe(true);
  });
});
