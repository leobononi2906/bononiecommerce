/**
 * Auto-update do app: registra o service worker e RECARREGA sozinho quando
 * uma versão nova assume — sem isso, cada deploy só chegava com F5 manual.
 *
 * `recarregando` evita o laço: sem ele, o primeiro registro num navegador que
 * ainda não tinha controlador recarregaria para sempre.
 */
export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;   // em desenvolvimento só atrapalha

  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Confere de tempos em tempos se há versão nova.
      setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
    }).catch(() => {});
  });
}
