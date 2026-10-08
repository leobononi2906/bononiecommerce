import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING = "https://api.bling.com.br/Api/v3";
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

const LIMITE_PAGINA = 100;
const THROTTLE_MS = 350;
const ORCAMENTO_MS = 110_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normSku = (s: unknown) => String(s ?? "").trim().replace(/^0+/, "");

// Arredonda preço para inteiro (sem casas decimais) antes de enviar ao Bling
const roundPreco = (n: number | null) => (n == null ? null : Math.round(n));
const round3 = (n: number | null) => (n == null ? null : Math.round(n * 1000) / 1000);

// Campos que NÃO devem ser reenviados no PUT — evita sobrescrever imagens e dados read-only
const CAMPOS_REMOVER_PUT = [
  'midia', 'imagens', 'imagemURL', 'imageThumbnail',
  'anexos', 'variacoes', 'categoriaProduto',
  'tributacao', 'actionEstoque'
];

async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function getConfig(): Promise<Record<string, string>> {
  const rows = await sbGet(`ped_configuracoes?select=chave,valor`);
  const c: Record<string, string> = {};
  for (const row of rows) c[row.chave] = row.valor;
  return c;
}

async function getAccessToken(): Promise<string> {
  const cfg = await getConfig();
  const refresh = cfg["bling_refresh_token"];
  if (!refresh) throw new Error("bling_refresh_token ausente em ped_configuracoes");
  const basic = btoa(`${Deno.env.get("BLING_CLIENT_ID")}:${Deno.env.get("BLING_CLIENT_SECRET")}`);
  const r = await fetch(`${BLING}/oauth/token`, {
    method: "POST",
    headers: { "enable-jwt": "1", Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!r.ok) throw new Error(`Bling token: ${r.status} ${await r.text()}`);
  const data = await r.json();
  if (data.refresh_token) {
    await fetch(`${SB_URL}/rest/v1/ped_configuracoes?chave=eq.bling_refresh_token`, {
      method: "PATCH", headers: sbHeaders, body: JSON.stringify({ valor: data.refresh_token }),
    });
  }
  return data.access_token;
}

async function blingGet(token: string, path: string) {
  const r = await fetch(`${BLING}${path}`, { headers: { "enable-jwt": "1", Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GET ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
async function listarDepositos(token: string) {
  const data = await blingGet(token, `/depositos`);
  return (data?.data ?? []).map((d: any) => ({ id: d.id, descricao: d.descricao, padrao: d.padrao }));
}
async function atualizarPreco(token: string, id: number, novoPreco: number) {
  const full = (await blingGet(token, `/produtos/${id}`))?.data;
  if (!full) throw new Error(`produto ${id} sem corpo`);
  full.preco = novoPreco;
  // Remove campos de mídia e read-only para NÃO sobrescrever imagens
  for (const campo of CAMPOS_REMOVER_PUT) {
    delete full[campo];
  }
  const r = await fetch(`${BLING}/produtos/${id}`, {
    method: "PUT", headers: { "enable-jwt": "1", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(full),
  });
  if (!r.ok) throw new Error(`PUT preco ${id}: ${r.status} ${await r.text()}`);
}
async function lancarBalanco(token: string, idProduto: number, idDeposito: number, qtd: number) {
  const r = await fetch(`${BLING}/estoques`, {
    method: "POST", headers: { "enable-jwt": "1", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ produto: { id: idProduto }, deposito: { id: idDeposito }, operacao: "B", quantidade: qtd }),
  });
  if (!r.ok) throw new Error(`balanco ${idProduto}: ${r.status} ${await r.text()}`);
}

async function compararPagina(token: string, pagina: number) {
  const lista = await blingGet(token, `/produtos?pagina=${pagina}&limite=${LIMITE_PAGINA}&criterio=2`);
  await sleep(THROTTLE_MS);
  const produtos = lista?.data ?? [];
  if (produtos.length === 0) return { vazio: true, itens: [] as any[] };

  const skus = [...new Set(produtos.map((p: any) => normSku(p.codigo)).filter(Boolean))];
  const erpMap = new Map<string, any>();
  if (skus.length) {
    const inList = skus.map((s) => `"${s}"`).join(",");
    const rows = await sbGet(
      `bling_produtos_sync?select=sku,id_produto,nome,preco,estoque,sincronizar,preco_manual,estoque_manual,preco_envio,estoque_envio&sku=in.(${inList})`
    );
    for (const r of rows) erpMap.set(String(r.sku), r);
  }

  const itens = produtos.map((p: any) => {
    const sku = normSku(p.codigo);
    const erp = erpMap.get(sku);
    const precoBling = Number(p.preco ?? 0);
    const estBlingRaw = p.estoque?.saldoVirtualTotal ?? p.estoque?.saldoFisicoTotal;
    const estBling = estBlingRaw == null ? null : Number(estBlingRaw);

    const precoErp = erp ? Number(erp.preco) : null;
    const estErp = erp ? Number(erp.estoque) : null;

    // preco_envio arredondado para inteiro — sem casas decimais no Bling
    const precoEnvioRaw = erp && erp.preco_envio != null ? round3(Number(erp.preco_envio)) : null;
    const precoEnvio = precoEnvioRaw != null ? roundPreco(precoEnvioRaw) : null;
    const estEnvio = erp && erp.estoque_envio != null ? round3(Number(erp.estoque_envio)) : null;

    return {
      sku, codigo: p.codigo, nome: p.nome, id_bling: p.id, id_produto: erp?.id_produto ?? null,
      achou: !!erp,
      sincronizar: erp ? !!erp.sincronizar : true,
      precoManual: erp?.preco_manual ?? null,
      estoqueManual: erp?.estoque_manual ?? null,
      precoErp, estErp, precoBling, estBling,
      precoEnvio, estEnvio,
      mudaPreco: precoEnvio != null && Math.abs(precoEnvio - precoBling) > 0.001,
      mudaEstoque: estEnvio != null && (estBling == null || Math.abs(estEnvio - estBling) > 0.001),
    };
  });
  return { vazio: false, itens };
}

async function sync(token: string, modoReal: boolean, paginaInicial: number, idDeposito: string) {
  const t0 = Date.now();
  const det: any[] = [];
  const todos: any[] = [];
  let pagina = paginaInicial;
  let totalBling = 0, naoEncontrados = 0, precoAlt = 0, estoqueAlt = 0, erros = 0, concluido = false;

  while (true) {
    if (Date.now() - t0 > ORCAMENTO_MS) break;
    const { vazio, itens } = await compararPagina(token, pagina);
    if (vazio) { concluido = true; break; }
    totalBling += itens.length;

    for (const it of itens) {
      todos.push({
        sku: it.sku,
        nome: it.nome,
        achou: it.achou,
        sincronizar: it.sincronizar,
        precoErp: it.precoErp,
        precoBling: it.precoBling,
        precoEnvio: it.precoEnvio,
        estErp: it.estErp,
        estBling: it.estBling,
        estEnvio: it.estEnvio,
        mudaPreco: it.mudaPreco,
        mudaEstoque: it.mudaEstoque,
      });

      if (!it.achou) {
        naoEncontrados++;
        if (det.length < 300) det.push({ sku: it.sku, codigo: it.codigo, status: "nao_encontrado_no_erp" });
        continue;
      }
      if (it.mudaPreco) {
        const reg: any = { sku: it.sku, id_bling: it.id_bling, campo: "preco", de: it.precoBling, para: it.precoEnvio };
        try {
          if (modoReal) { await atualizarPreco(token, it.id_bling, it.precoEnvio); await sleep(THROTTLE_MS * 2); }
          precoAlt++; if (det.length < 300) det.push(reg);
        } catch (e) { erros++; if (det.length < 300) det.push({ ...reg, erro: String(e) }); }
      }
      if (idDeposito && it.mudaEstoque) {
        const reg: any = { sku: it.sku, id_bling: it.id_bling, campo: "estoque", de: it.estBling, para: it.estEnvio };
        try {
          if (modoReal) { await lancarBalanco(token, it.id_bling, Number(idDeposito), it.estEnvio); await sleep(THROTTLE_MS); }
          estoqueAlt++; if (det.length < 300) det.push(reg);
        } catch (e) { erros++; if (det.length < 300) det.push({ ...reg, erro: String(e) }); }
      }
    }
    pagina++;
  }

  const resumo = {
    modo: modoReal ? "real" : "dryrun",
    pagina_inicial: paginaInicial, pagina_final: pagina - (concluido ? 1 : 0),
    proxima_pagina: concluido ? null : pagina, concluido,
    total_bling: totalBling, nao_encontrados: naoEncontrados,
    preco_alterados: precoAlt, estoque_alterados: estoqueAlt, erros,
    duracao_seg: Math.round((Date.now() - t0) / 100) / 10,
  };

  await fetch(`${SB_URL}/rest/v1/bling_sync_log`, {
    method: "POST",
    headers: sbHeaders,
    body: JSON.stringify({ ...resumo, detalhes: det, snapshot: todos }),
  });

  return resumo;
}

// ── Porta de entrada (06/10/2026) ─────────────────────────────────────────────
// Esta função publicada com Verify JWT desligado respondia a qualquer pessoa: cada chamada renova o
// token do Bling e `acao=sync&modo=real` escreve preço e estoque lá. Ligar o Verify JWT não bastaria
// (a chave anon pública é um JWT válido), então a checagem é feita aqui, ANTES de tocar no Bling:
//   1) cron: cabeçalho x-sync-key igual a ped_configuracoes.bling_sync_chave; ou
//   2) pessoa logada que seja admin global ou tenha o módulo 'ecommerce' em user_metadata.
async function chamadaAutorizada(req: Request): Promise<boolean> {
  const recebida = req.headers.get("x-sync-key") ?? "";
  if (recebida) {
    const r = await fetch(`${SB_URL}/rest/v1/ped_configuracoes?chave=eq.bling_sync_chave&select=valor`, { headers: sbHeaders });
    const esperada: string = r.ok ? ((await r.json())?.[0]?.valor ?? "") : "";
    if (!esperada || esperada.length !== recebida.length) return false;
    let dif = 0;
    for (let i = 0; i < esperada.length; i++) dif |= esperada.charCodeAt(i) ^ recebida.charCodeAt(i);
    return dif === 0;
  }
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
  if (!u.ok) return false;
  const meta = (await u.json())?.user_metadata ?? {};
  const mods: string[] = Array.isArray(meta.modulos) ? meta.modulos : [];
  return meta.admin === true || meta.admin === "true" || mods.includes("ecommerce");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b, null, 2), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  if (!(await chamadaAutorizada(req))) return json({ erro: "nao autorizado" }, 401);

  try {
    const url = new URL(req.url);
    const acao = url.searchParams.get("acao") ?? "sync";
    const cfg = await getConfig();
    const token = await getAccessToken();

    if (acao === "depositos") return json({ depositos: await listarDepositos(token) });

    if (acao === "conferir") {
      const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? "1"));
      const { vazio, itens } = await compararPagina(token, pagina);
      return json({
        pagina,
        proxima_pagina: vazio || itens.length < LIMITE_PAGINA ? null : pagina + 1,
        concluido: vazio || itens.length < LIMITE_PAGINA,
        deposito_configurado: !!cfg["bling_deposito_id"],
        itens,
      });
    }

    if (acao === "sync") {
      const pedidoReal = url.searchParams.get("modo") === "real";
      const ativo = (cfg["bling_sync_ativo"] ?? "false") === "true";
      const idDeposito = cfg["bling_deposito_id"] ?? "";
      const pagina = Math.max(1, Number(url.searchParams.get("pagina") ?? "1"));
      if (pedidoReal && !ativo)
        return json({ erro: "modo=real pedido, mas bling_sync_ativo=false. Ligue o interruptor quando confiar no dry-run." }, 400);
      if (pedidoReal && ativo && !idDeposito)
        return json({ erro: "bling_deposito_id vazio. Rode ?acao=depositos e salve o id em ped_configuracoes." }, 400);
      return json(await sync(token, pedidoReal && ativo, pagina, idDeposito));
    }

    return json({ erro: `acao desconhecida: ${acao}` }, 400);
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
