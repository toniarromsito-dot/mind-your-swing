import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAndroidBackButton, resetBackButtonHandlerForTests, setBackButtonHandler } from "./back-button";

describe("handleAndroidBackButton / setBackButtonHandler — back físico/gesto de Android durante una partida", () => {
  afterEach(() => {
    resetBackButtonHandlerForTests();
  });

  it("sin ninguna pantalla interceptando el atrás, reproduce el comportamiento por defecto: retrocede si puede", () => {
    const goBack = vi.fn();
    const exitApp = vi.fn();
    handleAndroidBackButton(true, { goBack, exitApp });
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("sin ninguna pantalla interceptando el atrás, cierra la app si no hay a dónde volver", () => {
    const goBack = vi.fn();
    const exitApp = vi.fn();
    handleAndroidBackButton(false, { goBack, exitApp });
    expect(exitApp).toHaveBeenCalledTimes(1);
    expect(goBack).not.toHaveBeenCalled();
  });

  it("mientras Focus Mode ha registrado un handler (partida en curso), el atrás se delega a él en vez de navegar", () => {
    const goBack = vi.fn();
    const exitApp = vi.fn();
    const onBackDuringGame = vi.fn();

    setBackButtonHandler(onBackDuringGame);
    handleAndroidBackButton(true, { goBack, exitApp });

    expect(onBackDuringGame).toHaveBeenCalledTimes(1);
    expect(goBack).not.toHaveBeenCalled();
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("delega al handler activo incluso sin historial (canGoBack=false) — nunca cierra la app de golpe durante una partida", () => {
    const exitApp = vi.fn();
    const onBackDuringGame = vi.fn();
    setBackButtonHandler(onBackDuringGame);

    handleAndroidBackButton(false, { goBack: vi.fn(), exitApp });

    expect(onBackDuringGame).toHaveBeenCalledTimes(1);
    expect(exitApp).not.toHaveBeenCalled();
  });

  it("al quitar el handler (equivalente a desmontar Focus Mode), el atrás vuelve a su comportamiento normal", () => {
    const goBack = vi.fn();
    const onBackDuringGame = vi.fn();
    setBackButtonHandler(onBackDuringGame);
    setBackButtonHandler(null); // limpieza al desmontar, ver useEffect de GameView

    handleAndroidBackButton(true, { goBack, exitApp: vi.fn() });

    expect(onBackDuringGame).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it("registrar un nuevo handler sustituye al anterior sin acumular (nunca se llaman dos handlers a la vez)", () => {
    const first = vi.fn();
    const second = vi.fn();
    setBackButtonHandler(first);
    setBackButtonHandler(second);

    handleAndroidBackButton(true, { goBack: vi.fn(), exitApp: vi.fn() });

    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
