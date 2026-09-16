// ecom-meta-sync — puxa o custo de mídia do Meta Ads para `ecom_meta_ads`.
// Cron 16 ("Sync Meta Daily"), 06:00 BRT.
//
// ⚠️ Edge Function NÃO sobe com o deploy do site nem pelo CLI desta máquina: publicar pelo
//    painel do Supabase. Este arquivo existe para o fonte parar de morar só dentro do banco.
//
// ── Por que esta versão existe (16/09/2026) ────────────────────────────────────────────────
// A versão anterior buscava **só o dia de ontem**. Como o `upsert` é a única forma de o dado
// entrar, um dia que falhasse **não era buscado nunca mais** — e não havia nada que avisasse:
// o cron chama `net.http_post`, que é assíncrono, então ele marca "succeeded" só por ter
// enfileirado a requisição, mesmo quando a função devolve 500.
//
// O resultado foi um rombo silencioso: buracos soltos em 08/05, 14-15/07, 18/07, 30-31/07 e
// 04/08, e depois 7 dias seguidos (10 a 16/09), com os anúncios rodando o tempo todo
// (127 a 186 leads de anúncio por dia no período). Custo faltando infla o ROAS da Home, porque
// a receita é do período inteiro e o investimento só vai até onde a carga chegou.
//
// A causa da parada de setembro veio da própria API, em texto claro:
//   "API access disrupted. Go to the App Dashboard and complete Data Use Checkup."
// Isso se resolve no App Dashboard do Meta, não aqui. O que se resolve aqui é o dia perdido
// virar dia perdido para sempre: com a janela de backfill, assim que o acesso voltar os dias
// em falta entram sozinhos na execução seguinte.
//
// Uma chamada só cobre a janela inteira: `time_increment=1` já devolve uma linha por dia.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

/** Dias para trás, contados a partir de ontem. 7 cobre uma semana de indisponibilidade sem
 *  pesar: o `upsert` é idempotente, então reprocessar dia que já entrou não duplica nada.
 *  Para recuperar um rombo maior, chame a função com `{"dias": 30}` no corpo. */
const DIAS_PADRAO = 7
const DIAS_MAX = 90

Deno.serve(async (req) => {
  const inicio = Date.now()

  try {
    const TOKEN = Deno.env.get('META_ACCESS_TOKEN')!
    const AD_ACCOUNT = Deno.env.get('META_AD_ACCOUNT_ID')!
    if (!TOKEN || !AD_ACCOUNT) throw new Error('Credenciais Meta não configuradas')

    let dias = DIAS_PADRAO
    try {
      const corpo = await req.json()
      if (corpo?.dias) dias = Math.min(Math.max(1, Number(corpo.dias) | 0), DIAS_MAX)
    } catch { /* sem corpo: usa o padrão */ }

    // Datas em UTC, como na versão anterior — o Meta interpreta `time_range` no fuso da conta
    // de anúncios, e mexer nisso junto com o backfill misturaria duas mudanças. Um eventual
    // deslocamento de um dia na borda se corrige sozinho na execução seguinte, agora que a
    // janela cobre vários dias.
    const dia = (atras: number) => {
      const d = new Date()
      d.setDate(d.getDate() - atras)
      return d.toISOString().split('T')[0]
    }
    const desde = dia(dias)
    const ate = dia(1)

    const timeRange = encodeURIComponent(JSON.stringify({ since: desde, until: ate }))
    let url = `https://graph.facebook.com/v19.0/${AD_ACCOUNT}/insights`
      + `?fields=campaign_name,adset_name,impressions,clicks,spend,actions,date_start`
      + `&time_range=${timeRange}&level=adset&time_increment=1&limit=500&access_token=${TOKEN}`

    const registros: any[] = []
    let paginas = 0
    while (url) {
      const res = await fetch(url)
      const json = await res.json()
      // Erro da API precisa subir como erro: é o que separa "não veio nada" de "não consegui
      // perguntar". Foi confundir os dois que deixou a falha invisível por uma semana.
      if (json.error) throw new Error(`Meta API: ${json.error.message}`)
      registros.push(...(json.data || []))
      paginas++
      url = json.paging?.next || null
      if (url) await new Promise(r => setTimeout(r, 500))
    }

    if (registros.length === 0) {
      // Resposta válida e vazia: ou não houve veiculação na janela, ou a conta está sem dado.
      // Não é erro — mas também não é sucesso silencioso, então vai explícito no retorno.
      return new Response(JSON.stringify({
        ok: true, aviso: 'a API respondeu sem nenhum registro na janela',
        desde, ate, dias, registros: 0, duration_ms: Date.now() - inicio,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const rows = registros.map((d: any) => ({
      data: d.date_start,
      campanha: d.campaign_name || 'N/A',
      conjunto: d.adset_name || 'N/A',
      impressoes: parseInt(d.impressions || '0'),
      cliques: parseInt(d.clicks || '0'),
      investimento: parseFloat(d.spend || '0'),
      leads: parseInt(
        d.actions?.find((a: any) =>
          a.action_type === 'onsite_conversion.messaging_conversation_started_7d'
        )?.value || 0,
      ),
    }))

    const { error } = await supabase
      .from('ecom_meta_ads')
      .upsert(rows, { onConflict: 'data,campanha,conjunto' })
    if (error) throw new Error(`Supabase: ${error.message}`)

    // Quais dias a janela realmente trouxe — é o que se confere depois de uma recuperação.
    const dias_gravados = [...new Set(rows.map(r => r.data))].sort()

    return new Response(JSON.stringify({
      ok: true, desde, ate, dias, paginas,
      registros: rows.length, dias_gravados,
      investimento_total: Number(rows.reduce((s, r) => s + r.investimento, 0).toFixed(2)),
      duration_ms: Date.now() - inicio,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`[ERRO] ${msg}`)
    return new Response(JSON.stringify({
      ok: false, error: msg, duration_ms: Date.now() - inicio,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
