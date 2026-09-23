import { describe, expect, it } from "vitest";
import { AD_ALLOWED_PATHS, isAdEligible, isAdEligiblePath } from "./policy";

/**
 * Fase 11F — política de ubicación de anuncios. Estos tests son la garantía
 * central de "Jugar/Coach nunca muestran anuncios" y "PRO nunca ve
 * anuncios": si algún día se añade una ruta nueva sin querer a la
 * allowlist, o si `adFree` deja de tenerse en cuenta, uno de estos tests
 * rompe.
 */
describe("isAdEligiblePath", () => {
  it("las 4 áreas aprobadas son elegibles", () => {
    expect(isAdEligiblePath("/dashboard")).toBe(true);
    expect(isAdEligiblePath("/community")).toBe(true);
    expect(isAdEligiblePath("/aprende")).toBe(true);
    expect(isAdEligiblePath("/insights")).toBe(true);
  });

  it("todo el árbol de Jugar queda excluido, incluidas subrutas dinámicas (Focus Mode)", () => {
    expect(isAdEligiblePath("/play")).toBe(false);
    expect(isAdEligiblePath("/play/new")).toBe(false);
    expect(isAdEligiblePath("/play/join")).toBe(false);
    expect(isAdEligiblePath("/play/abc123")).toBe(false); // Focus Mode / scorecard en uso
    expect(isAdEligiblePath("/play/abc123/resumen")).toBe(false);
    expect(isAdEligiblePath("/play/historial")).toBe(false);
  });

  it("Coach (llamada de voz activa) queda excluido", () => {
    expect(isAdEligiblePath("/coach")).toBe(false);
  });

  it("subpáginas no revisadas de Aprende/Comunidad quedan excluidas por defecto (allowlist exacta, no prefijo)", () => {
    expect(isAdEligiblePath("/aprende/ejercicios/respiracion")).toBe(false);
    expect(isAdEligiblePath("/aprende/videos")).toBe(false);
    expect(isAdEligiblePath("/community/friends")).toBe(false);
    expect(isAdEligiblePath("/community/tournaments")).toBe(false);
  });

  it("pantallas ajenas (perfil, settings, raíz) quedan excluidas por defecto", () => {
    expect(isAdEligiblePath("/")).toBe(false);
    expect(isAdEligiblePath("/perfil")).toBe(false);
    expect(isAdEligiblePath("/settings")).toBe(false);
  });

  it("la allowlist exportada es exactamente la esperada (documenta el contrato, no un detalle de implementación)", () => {
    expect([...AD_ALLOWED_PATHS].sort()).toEqual(["/aprende", "/community", "/dashboard", "/insights"]);
  });
});

describe("isAdEligible", () => {
  it("FREE en una ruta permitida → elegible", () => {
    expect(isAdEligible("/dashboard", false)).toBe(true);
  });

  it("PRO/owner (adFree=true) nunca es elegible, ni siquiera en una ruta permitida", () => {
    expect(isAdEligible("/dashboard", true)).toBe(false);
    expect(isAdEligible("/community", true)).toBe(false);
    expect(isAdEligible("/aprende", true)).toBe(false);
    expect(isAdEligible("/insights", true)).toBe(false);
  });

  it("FREE en Jugar/Focus Mode nunca es elegible, pase lo que pase con adFree", () => {
    expect(isAdEligible("/play/abc123", false)).toBe(false);
    expect(isAdEligible("/play/abc123", true)).toBe(false);
  });

  it("FREE en Coach nunca es elegible", () => {
    expect(isAdEligible("/coach", false)).toBe(false);
  });
});
