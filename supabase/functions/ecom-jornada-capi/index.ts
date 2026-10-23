import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// ============================================================================
// ecom-jornada-capi  (manda ao Meta as mudanças de etapa da jornada própria)
//
// Lê ecom_jornada_historico com capi = 'pendente', dos últimos 7 dias, e manda cada uma como evento da API de Conversões no
// formato que o Tintim usa: action_source 'chat', telefone com hash, e valor
// só na Compra. O destino vem de ecom_jornada_controle (não é segredo):
//   meta_dataset_id  PIXEL TINTIM
//   meta_test_code   código do Test Events desse pixel
//   meta_modo        'teste' (só Test Events) | 'real' | 'desligado'
// Secrets: META_CAPI_TOKEN (usuário do sistema "contato") e CAPI_CRON_KEY.
//
// Quem pode chamar: só com o header x-capi-key igual ao secret CAPI_CRON_KEY.
// A URL é pública e o JWT do gateway (anon) não é segredo.
// Status: pendente -> testado (modo teste) | enviado (modo real) | erro | expirado
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CAPI_TOKEN   = Deno.env.get('META_CAPI_TOKEN') ?? ''
const CRON_KEY     = Deno.env.get('CAPI_CRON_KEY') ?? ''
const GRAPH        = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0'

const JANELA_MS = 7 * 86400000   // o Meta recusa evento com mais de 7 dias
const LOTE_MAX  = 200            // teto por rodada, para não estourar o tempo da função
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } })

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Telefone em E.164 só com dígitos, com o 55 do Brasil, como o Meta pede antes do hash.
function telefoneMeta(tel: string): string | null {
  let d = (tel ?? '').replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  return d.length >= 12 ? d : null
}

// Primeiro nome em minúsculas, sem acento e sem símbolo (emoji, ponto), como o Meta pede antes do hash.
function primeiroNome(nome: string | null): string | null {
  const n = (nome ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z ]/g, ' ').trim().split(/\s+/)[0]
  return n && n.length >= 2 ? n : null
}

Deno.serve(async (req) => {
  try {
    if (CRON_KEY === '' || (req.headers.get('x-capi-key') ?? '') !== CRON_KEY) {
      return json({ erro: 'não autorizado' }, 401)
    }
    if (!CAPI_TOKEN) return json({ erro: 'configuração incompleta', faltando: ['META_CAPI_TOKEN'] }, 500)

    const { data: ctl, error: ctlErr } = await sb.from('ecom_jornada_controle').select('chave, valor')
      .in('chave', ['meta_dataset_id', 'meta_test_code', 'meta_modo'])
    if (ctlErr) throw ctlErr
    const cfg = Object.fromEntries((ctl ?? []).map((c: any) => [c.chave, c.valor]))
    const modo = cfg.meta_modo ?? 'desligado'
    const dataset = cfg.meta_dataset_id ?? ''
    const testCode = cfg.meta_test_code ?? ''
    if (modo === 'desligado') return json({ modo, enviados: 0 })
    if (!dataset || (modo === 'teste' && !testCode)) {
      return json({ erro: 'configuração incompleta', modo, dataset: !!dataset, test_code: !!testCode }, 500)
    }

    const corte = new Date(Date.now() - JANELA_MS).toISOString()

    // Fora da janela o Meta recusa: sai da fila. No modo teste não mexe (não é envio real).
    let expirados = 0
    if (modo === 'real') {
      const { data: exp, error: expErr } = await sb.from('ecom_jornada_historico')
        .update({ capi: 'expirado' }).eq('capi', 'pendente').lt('ocorrido_em', corte).select('id')
      if (expErr) throw expErr
      expirados = exp?.length ?? 0
    }

    // Os dois modos só pegam 'pendente'. O que foi ao Test Events no paralelo com o Tintim NÃO vai de verdade
    // depois: o Tintim já mandou essas mudanças, e reenviar contaria duas vezes na virada.
    const elegiveis = ['pendente']
    const { data: fila, error: filaErr } = await sb.from('ecom_jornada_historico')
      .select('id, evento_meta, ocorrido_em, valor, ecom_jornada_lead(chave_tel, telefone, nome, ctwa_clid)')
      .in('capi', elegiveis).gte('ocorrido_em', corte).not('evento_meta', 'is', null)
      .order('ocorrido_em', { ascending: true }).limit(LOTE_MAX)
    if (filaErr) throw filaErr

    let ok = 0, erros = 0, adiados = 0
    const porEvento: Record<string, number> = {}
    for (const h of fila ?? []) {
      const lead = (h as any).ecom_jornada_lead
      const ph = telefoneMeta(lead?.telefone)
      const fn = primeiroNome(lead?.nome)
      const user_data: Record<string, unknown> = { external_id: [await sha256(lead.chave_tel)] }
      if (ph) user_data.ph = [await sha256(ph)]
      if (fn) user_data.fn = [await sha256(fn)]
      if (lead?.ctwa_clid) user_data.ctwa_clid = lead.ctwa_clid

      const item: Record<string, unknown> = {
        event_name: h.evento_meta,
        event_time: Math.min(Math.floor(new Date(h.ocorrido_em).getTime() / 1000), Math.floor(Date.now() / 1000) - 60),
        event_id: `jornada-${h.id}`,          // o Meta deduplica se a mesma mudança for mandada de novo
        action_source: 'chat',
        user_data,
      }
      if (h.evento_meta === 'Purchase') item.custom_data = { currency: 'BRL', value: Number(h.valor ?? 0) }

      const body: Record<string, unknown> = { data: [item] }
      if (modo === 'teste') body.test_event_code = testCode

      let status = 'pendente', resposta: any = null, sucesso = false, transitorio = false
      try {
        const resp = await fetch(`https://graph.facebook.com/${GRAPH}/${dataset}/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CAPI_TOKEN}` },
          body: JSON.stringify(body),
        })
        resposta = await resp.json().catch(() => ({}))
        sucesso = resp.ok && Number(resposta?.events_received ?? 0) >= 1
        transitorio = resp.status === 429 || resp.status >= 500
      } catch (e) {
        resposta = { erro_rede: String(e) }
        transitorio = true
      }

      if (sucesso) {
        status = modo === 'teste' ? 'testado' : 'enviado'
        ok++
        porEvento[h.evento_meta] = (porEvento[h.evento_meta] ?? 0) + 1
      } else if (transitorio) {
        adiados++                         // continua na fila; tenta na próxima rodada
        continue
      } else {
        status = 'erro'; erros++          // 4xx: mandar igual de novo só repete o erro
      }
      const { error: upErr } = await sb.from('ecom_jornada_historico')
        .update({ capi: status, resposta_meta: resposta, enviado_em: new Date().toISOString() }).eq('id', h.id)
      if (upErr) throw upErr
    }

    return json({ modo, dataset, na_fila: fila?.length ?? 0, ok, erros, adiados, expirados, por_evento: porEvento })
  } catch (e) {
    return json({ erro: String(e) }, 500)
  }
})
