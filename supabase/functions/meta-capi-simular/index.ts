import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// ============================================================================
// meta-capi-simular  (grava a fila e, se ligada, ENVIA o Purchase ao Meta CAPI)
//
// Cruza vendas atribuidas a anuncio (vw_capi_pendentes), monta o evento
// 'Purchase' do CAPI para Business Messaging (Click-to-WhatsApp) e grava em
// meta_capi_eventos. Status: simulado -> (testado) -> enviado | erro | expirado.
//
// SEM secrets de envio a funcao so SIMULA (status='simulado'), como antes.
// ENVIO so acontece quando TODAS estiverem setadas:
//   META_CAPI_ENVIAR      = 'true'
//   META_CAPI_DATASET_ID  = id do conjunto de dados do CTWA
//   META_CAPI_TOKEN       = token com permissao de envio (ads_management)
//   META_WABA_ID          = id da conta do WhatsApp Business (WABA) do canal
// Opcionais:
//   META_CAPI_TEST_CODE   = codigo do Test Events. Com ele o evento vai ao
//                           Test Events (nao conta como conversao) e fica
//                           'testado', continuando elegivel ao envio real.
//   META_GRAPH_VERSION    = padrao v23.0
//
// Quem pode ENVIAR: so chamada com o header x-capi-key igual ao secret
// CAPI_CRON_KEY (cron / operador). Qualquer outra chamada apenas simula — a
// URL da funcao e publica e o JWT do gateway (anon) nao e segredo.
// ============================================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DATASET_ID   = Deno.env.get('META_CAPI_DATASET_ID') ?? ''
const CAPI_TOKEN   = Deno.env.get('META_CAPI_TOKEN') ?? ''
const WABA_ID      = Deno.env.get('META_WABA_ID') ?? ''
const TEST_CODE    = Deno.env.get('META_CAPI_TEST_CODE') ?? ''
const ENVIAR       = (Deno.env.get('META_CAPI_ENVIAR') ?? 'false') === 'true'
const GRAPH        = Deno.env.get('META_GRAPH_VERSION') ?? 'v23.0'
const CRON_KEY     = Deno.env.get('CAPI_CRON_KEY') ?? ''

const JANELA_MS  = 7 * 86400000   // o Meta recusa evento de mensageria com mais de 7 dias
const LOTE_MAX   = 200            // teto por rodada, para nao estourar o tempo da funcao
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o, null, 2), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  try {
    const url  = new URL(req.url)
    const dias = Number(url.searchParams.get('dias') ?? '30')
    const autorizado = CRON_KEY !== '' && (req.headers.get('x-capi-key') ?? '') === CRON_KEY

    // Sonda: envio ligado com configuracao pela metade e erro, nunca simulacao muda.
    if (ENVIAR && (!DATASET_ID || !CAPI_TOKEN || !WABA_ID || !CRON_KEY)) {
      return json({ erro: 'configuracao incompleta', faltando: [
        !DATASET_ID && 'META_CAPI_DATASET_ID', !CAPI_TOKEN && 'META_CAPI_TOKEN', !WABA_ID && 'META_WABA_ID',
        !CRON_KEY && 'CAPI_CRON_KEY',
      ].filter(Boolean) }, 500)
    }
    const podeEnviar = ENVIAR && autorizado

    // ---- 1) monta a fila (idempotente) ----
    const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)
    const { data: pend, error } = await sb.from('vw_capi_pendentes').select('*').gte('dt_venda', desde)
    if (error) throw error

    const eventos = (pend ?? []).map((r: any) => {
      const event_time = new Date(r.dt_venda + 'T12:00:00Z')
      return {
        chave_tel: r.chave_tel, telefone: r.telefone, ctwa_clid: r.ctwa_clid,
        ad_id: r.ad_id, campanha: r.campanha,
        event_name: 'Purchase', event_time: event_time.toISOString(),
        valor: r.valor, moeda: 'BRL', status: 'simulado',
        payload: { data: [{
          event_name: 'Purchase',
          event_time: Math.floor(event_time.getTime() / 1000),
          action_source: 'business_messaging',
          messaging_channel: 'whatsapp',
          user_data: { ctwa_clid: r.ctwa_clid },
          custom_data: { currency: 'BRL', value: Number(r.valor ?? 0) },
        }] },
      }
    })

    let novos = 0
    if (eventos.length) {
      const { error: upErr, count } = await sb.from('meta_capi_eventos')
        .upsert(eventos, { onConflict: 'chave_tel,event_name,event_time', ignoreDuplicates: true, count: 'exact' })
      if (upErr) throw upErr
      novos = count ?? 0
    }

    // ---- 2) envio real ----
    let enviados = 0, testados = 0, erros = 0, adiados = 0, expirados = 0, restantes = 0
    if (podeEnviar) {
      const corte = new Date(Date.now() - JANELA_MS).toISOString()

      // Fora da janela o Meta recusa: sai da fila. Em modo teste nao mexe (nao e envio real).
      if (!TEST_CODE) {
        const { data: exp, error: expErr } = await sb.from('meta_capi_eventos')
          .update({ status: 'expirado' })
          .in('status', ['simulado', 'testado']).lt('event_time', corte).select('id')
        if (expErr) throw expErr
        expirados = exp?.length ?? 0
      }

      // Teste so pega 'simulado' (evita repetir o que ja foi ao Test Events);
      // envio real pega tambem 'testado'.
      const statusElegiveis = TEST_CODE ? ['simulado'] : ['simulado', 'testado']
      const { data: aEnviar, error: selErr } = await sb.from('meta_capi_eventos')
        .select('*').in('status', statusElegiveis).gte('event_time', corte)
        .order('event_time', { ascending: true }).limit(LOTE_MAX)
      if (selErr) throw selErr

      for (const ev of aEnviar ?? []) {
        const agora = Math.floor(Date.now() / 1000)
        const item = { ...ev.payload.data[0] }
        item.event_time = Math.min(item.event_time, agora - 60)     // o Meta recusa evento no futuro
        item.event_id = `capi-${ev.id}`                             // dedupe se reenviar
        item.user_data = { ...item.user_data, whatsapp_business_account_id: WABA_ID }
        const body: any = { data: [item] }
        if (TEST_CODE) body.test_event_code = TEST_CODE

        let status = ev.status as string, resposta: any = null, ok = false, transitorio = false
        try {
          const resp = await fetch(`https://graph.facebook.com/${GRAPH}/${DATASET_ID}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CAPI_TOKEN}` },
            body: JSON.stringify(body),
          })
          resposta = await resp.json().catch(() => ({}))
          ok = resp.ok && Number(resposta?.events_received ?? 0) >= 1
          transitorio = resp.status === 429 || resp.status >= 500
        } catch (e) {
          resposta = { erro_rede: String(e) }
          transitorio = true
        }

        if (ok) {
          status = TEST_CODE ? 'testado' : 'enviado'
          TEST_CODE ? testados++ : enviados++
        } else if (transitorio) {
          adiados++                        // continua na fila; tenta na proxima rodada
        } else {
          status = 'erro'; erros++         // 4xx: reenviar igual so repete o erro
        }
        await sb.from('meta_capi_eventos').update({
          status, resposta_meta: resposta,
          enviado_em: ok || status === 'erro' ? new Date().toISOString() : null,
        }).eq('id', ev.id)
      }

      const { count } = await sb.from('meta_capi_eventos')
        .select('id', { count: 'exact', head: true }).in('status', statusElegiveis).gte('event_time', corte)
      restantes = count ?? 0
    }

    return json({
      modo: podeEnviar ? (TEST_CODE ? 'ENVIO_TESTE' : 'ENVIO_REAL') : 'SIMULACAO',
      envio_ligado: ENVIAR, chamada_autorizada: autorizado,
      janela_dias: dias, candidatos: eventos.length, novos_gravados: novos,
      enviados, testados, erros, adiados, expirados, restantes_na_fila: restantes,
      amostra: eventos.slice(0, 3),
    })
  } catch (e) {
    return json({ erro: String(e) }, 500)
  }
})
