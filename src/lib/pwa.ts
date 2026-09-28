/**
 * Auto-update do app: registra o service worker e aplica a versão nova SEM
 * tirar o gestor da tela.
 *
 * Antes recarregava na hora do `controllerchange` — no meio do cadastro de
 * parceiro (drawer `Parceiros.tsx`) ou de um formulário de Configurações.
 * Agora a versão nova fica "pronta" e só entra com a aba oculta ou a pessoa
 * parada há 10 min, e nunca com campo preenchido ou janela aberta. O reload
 * mantém a URL (a camada 2, `?parceiro=`, devolve o drawer).
 *
 * `temControlador`: o primeiro registro do navegador também dispara
 * `controllerchange` (via `clients.claim`), e isso não é versão nova — sem a
 * trava, o app recarregaria sozinho na primeira abertura.
 */
const OCIOSO_MS = 10 * 60 * 1000;

// Este app não usa Radix/shadcn: o drawer de Parceiros (`Parceiros.tsx`) é a
// única sobreposição própria hoje, e o painel visível é marcado com a classe
// `parc-drawer` (o `<div>` de fundo, que aparece/some junto, não tem classe
// própria). Mantém `role="dialog"` também, caso outro modal passe a usar
// Radix.
const SOBREPOSICAO = 'dialog[open],[role="dialog"],[aria-modal="true"],.parc-drawer';

function ocupado(): boolean {
  const a = document.activeElement as HTMLElement | null;
  // Campo focado VAZIO não segura: várias telas deixam o filtro focado à toa.
  if (a && (a.isContentEditable || (/^(INPUT|TEXTAREA)$/.test(a.tagName) && (a as HTMLInputElement).value !== ''))) return true;
  return [...document.querySelectorAll(SOBREPOSICAO)]
    .some(el => el.getClientRects().length > 0);   // só conta janela visível
}

export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;   // em desenvolvimento só atrapalha

  let temControlador = !!navigator.serviceWorker.controller;
  let versaoNovaPronta = false, recarregando = false, ultimoToque = Date.now();
  ['pointerdown', 'keydown', 'input'].forEach(ev =>
    window.addEventListener(ev, () => { ultimoToque = Date.now(); }, { capture: true, passive: true }));

  const podeRecarregarAgora = () =>
    !ocupado() && (document.visibilityState === 'hidden' || Date.now() - ultimoToque > OCIOSO_MS);

  const aplicarVersaoNova = () => {
    if (!versaoNovaPronta || recarregando || !podeRecarregarAgora()) return;
    recarregando = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!temControlador) { temControlador = true; return; }
    versaoNovaPronta = true;
    aplicarVersaoNova();
  });
  document.addEventListener('visibilitychange', aplicarVersaoNova);
  setInterval(aplicarVersaoNova, 60 * 1000);

  // A aba antiga pode pedir um pedaço carregado sob demanda que o deploy novo
  // já não tem: aí não há o que esperar, recarrega na mesma URL.
  window.addEventListener('vite:preloadError', evento => {
    if (recarregando) return;
    evento.preventDefault();
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
