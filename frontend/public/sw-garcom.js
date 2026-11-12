// Service worker do app do garçom (escopo /garcom). Só faz duas coisas: mostra o aviso que a API
// manda por push ("Mesa 5 — pedido pronto") e, ao tocar no aviso, abre o app. Não guarda cache:
// o app precisa de internet de qualquer jeito.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let aviso = { titulo: 'EasyMenu', corpo: 'Há um pedido pronto para levar.', tag: 'pronto', url: '/garcom' };
  try {
    aviso = { ...aviso, ...evento.data.json() };
  } catch {
    // mensagem sem JSON: fica o texto padrão
  }
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo,
      tag: aviso.tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      icon: '/icones/garcom-192.png',
      data: { url: aviso.url },
    }),
  );
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || '/garcom', self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.startsWith(`${self.location.origin}/garcom`));
      if (aberta) return aberta.focus().then((j) => j.navigate?.(destino) ?? j);
      return self.clients.openWindow(destino);
    }),
  );
});
