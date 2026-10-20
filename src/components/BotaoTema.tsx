import { useEffect, useRef } from "react";

declare global {
  interface Window {
    BnnTema?: { botao: (el: HTMLElement) => HTMLButtonElement | null };
  }
}

// Botão claro/escuro/sistema do kit (ds/bononi-tema.js). O visual vem do
// estilo injetado pelo próprio script, que já lê os tokens do DS (--border-default etc).
export function BotaoTema() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.firstChild) return;
    window.BnnTema?.botao(el);
  }, []);
  return <span ref={ref} className="inline-flex shrink-0" />;
}
