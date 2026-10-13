// Service worker minimo do SIVALE (cache-first para o shell da aplicacao)
const CACHE = "sivale-v1";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  // Nao interfere em chamadas de API - apenas no shell estatico
  if (event.request.method !== "GET" || event.request.url.includes("/auth") || event.request.url.includes(":3333")) return;
});
