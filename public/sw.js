// Service worker mínimo: solo existe para que el navegador considere la
// app "instalable" (criterio PWA). No cachea nada a propósito — la app es
// dinámica y depende de sesión, así que servir contenido cacheado podría
// mostrar datos desactualizados o de otro usuario.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // network passthrough intencional
});
