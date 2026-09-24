/**
 * Service worker do Stonni Dashboard (bononiecommerce).
 *
 * Existe só para o app pegar versão nova sozinho — sem isso, cada deploy
 * exigia F5 manual (reclamação recorrente nos apps Bononi/Stonni). Não é
 * cache para uso offline.
 *
 * A REGRA QUE EVITA SERVIR VERSÃO VELHA:
 *
 *   - `/assets/*` é o que o Vite gera COM HASH NO NOME (`index-a8T9rXaT.js`).
 *     Mudou o conteúdo, mudou o nome. Guardar para sempre é seguro por
 *     construção: nunca existe versão velha com o mesmo endereço.
 *   - TODO O RESTO vai na rede primeiro, sempre. Em especial o `index.html`,
 *     que é quem aponta para os assets: ele é a chave da atualização.
 *   - O `index.html` guardado só entra em cena quando a REDE FALHA (fallback
 *     offline). Online, a rede sempre ganha.
 *
 * Supabase e qualquer outra origem passam direto: não é deste service worker
 * cuidar deles.
 */
const CACHE = 'bononiecommerce-v1-20260924';
const FALLBACK = '/index.html';

self.addEventListener('install', evento => {
  // Assume o lugar do anterior sem esperar a aba fechar.
  self.skipWaiting();
  evento.waitUntil(
    caches.open(CACHE).then(c => c.add(FALLBACK)).catch(() => {})
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, fontes, CDN

  // Assets com hash no nome: do cache, e só busca na rede na primeira vez.
  if (url.pathname.startsWith('/assets/')) {
    evento.respondWith((async () => {
      const guardado = await caches.match(req);
      if (guardado) return guardado;
      const resposta = await fetch(req);
      if (resposta.ok) (await caches.open(CACHE)).put(req, resposta.clone());
      return resposta;
    })());
    return;
  }

  // Navegação: rede primeiro, sempre. O cache é só rede-caiu.
  if (req.mode === 'navigate') {
    evento.respondWith((async () => {
      try {
        const resposta = await fetch(req);
        if (resposta.ok) (await caches.open(CACHE)).put(FALLBACK, resposta.clone());
        return resposta;
      } catch {
        return (await caches.match(FALLBACK)) || Response.error();
      }
    })());
  }
});
