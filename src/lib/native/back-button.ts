/**
 * Botón/gesto atrás de Android durante la app — API de Capacitor
 * (@capacitor/app, evento "backButton"): registrar un listener desactiva
 * el comportamiento por defecto de Capacitor DE POR VIDA para esa sesión
 * de la WebView (no por pantalla, no reversible al quitar el listener) —
 * ver el propio doc de @capacitor/app: "Listening for this event will
 * disable the default back button behaviour, so you might want to call
 * window.history.back() manually." Por eso este listener se registra UNA
 * SOLA VEZ, global, para toda la app (en NativeAppInit, igual que
 * appUrlOpen/appStateChange) — nunca por pantalla, o cualquier pantalla
 * que quite su propio listener dejaría el back muerto en el resto de la
 * app para siempre.
 *
 * Las pantallas que necesitan interceptar el atrás (hoy, Focus Mode)
 * registran aquí un handler ligero en memoria en vez de tocar Capacitor
 * directamente — este registro decide, en cada pulsación real, si hay
 * alguien pidiendo interceptarlo o si hay que reproducir el
 * comportamiento por defecto que Capacitor ya no hace.
 */

export type BackButtonHandler = () => void;

let activeHandler: BackButtonHandler | null = null;

/**
 * Registra (o quita, con `null`) el handler que intercepta el atrás
 * mientras el componente que llama está montado — usar siempre desde un
 * useEffect con cleanup (`return () => setBackButtonHandler(null)`), para
 * no dejar un handler de una pantalla ya desmontada capturando el atrás
 * de otra.
 */
export function setBackButtonHandler(handler: BackButtonHandler | null) {
  activeHandler = handler;
}

/** Para tests: siempre null entre casos, nunca se filtra estado de una pantalla a otra. */
export function resetBackButtonHandlerForTests() {
  activeHandler = null;
}

/**
 * Qué hacer con una pulsación real del atrás: si una pantalla ha pedido
 * interceptarlo, se le delega (p. ej. Focus Mode mostrando su
 * confirmación de terminar partida) y NUNCA se navega; si no, se
 * reproduce a mano el comportamiento por defecto que Capacitor dejó de
 * hacer en cuanto existe este listener — retroceder en el historial si se
 * puede, o cerrar la app si no hay a dónde volver. Recibe las acciones
 * como parámetro para poder testearse sin Capacitor real ni un DOM real.
 */
export function handleAndroidBackButton(
  canGoBack: boolean,
  actions: { goBack: () => void; exitApp: () => void }
) {
  if (activeHandler) {
    activeHandler();
    return;
  }
  if (canGoBack) {
    actions.goBack();
  } else {
    actions.exitApp();
  }
}
