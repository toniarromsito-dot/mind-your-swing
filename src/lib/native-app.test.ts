import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NATIVE_APP_USER_AGENT_MARKER, isNativeAppUserAgent } from "@/lib/native-app";

describe("isNativeAppUserAgent", () => {
  it("detecta el User-Agent del WebView de la app (con la marca añadida por Capacitor)", () => {
    expect(
      isNativeAppUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MindYourSwingApp"
      )
    ).toBe(true);
  });

  it("un navegador normal (Safari, Chrome, PWA) no es la app", () => {
    expect(
      isNativeAppUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
    expect(isNativeAppUserAgent(null)).toBe(false);
    expect(isNativeAppUserAgent(undefined)).toBe(false);
  });

  it("la marca coincide con appendUserAgent de capacitor.config.ts", () => {
    const config = readFileSync("capacitor.config.ts", "utf8");
    expect(config).toContain(`appendUserAgent: "${NATIVE_APP_USER_AGENT_MARKER}"`);
  });
});
