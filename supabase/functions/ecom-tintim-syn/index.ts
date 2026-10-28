import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ACCOUNT_CODE = Deno.env.get('TINTIM_ACCOUNT_CODE')!
const ACCOUNT_TOKEN = Deno.env.get('TINTIM_ACCOUNT_TOKEN')!

async function buscarLead(telefone) {
  try {
    const url = 'https://s.tintim.app/api/v1/' + ACCOUNT_CODE + '/lead/' + telefone + '?token=' + ACCOUNT_TOKEN
    const res = await fetch(url)
    if (!res.ok) return null
    const json = await res.json()
    if (!json || json.error) return null
    return json
  } catch (e) {
    return null
  }
}

// 28/10/2026: só o cron (header x-cron-chave = segredo `geral_cron_chave` do Vault, conferido pela RPC
// geral_cron_chave_confere, Hub 0078) ou a chave de serviço. Antes qualquer um com a URL disparava a função.
async function chamadaAutorizada(req: Request): Promise<boolean> {
  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (servico && token === servico) return true;
  const chave = req.headers.get("x-cron-chave") ?? "";
  if (chave.length < 32) return false;
  const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/geral_cron_chave_confere`, {
    method: "POST",
    headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_chave: chave }),
  }).catch(() => null);
  return !!r && r.ok && (await r.json().catch(() => false)) === true;
}

Deno.serve(async function(req) {
  if (req.method !== "OPTIONS" && !(await chamadaAutorizada(req))) {
    return new Response(JSON.stringify({ erro: "não autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  try {
    const result = await supabase
      .from('ecom_leads')
      .select('telefone, nome, criado_em')
      .gte('criado_em', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('criado_em', { ascending: false })
      .limit(100)

    const leads = result.data || []
    let atualizados = 0
    let nao_encontrados = 0

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const dados = await buscarLead(lead.telefone)

      if (!dados) {
        nao_encontrados++
        continue
      }

      await supabase.from('ecom_tintim_leads').upsert({
        telefone: lead.telefone,
        nome: dados.name || lead.nome,
        status_id: dados.status ? dados.status.id : null,
        status_nome: dados.status ? dados.status.name : null,
        campanha: dados.ad?.campaign_name || null,
        conjunto: dados.ad?.adset_name || null,
        anuncio: dados.ad?.ad_name || null,
        utm_source: dados.source || null,
        utm_medium: null,
        utm_campaign: dados.ad?.campaign_name || null,
        valor_venda: dados.sale_amount || null,
        criado_em: dados.created_isoformat || lead.criado_em,
        atualizado_em: new Date().toISOString()
      }, { onConflict: 'telefone' })

      atualizados++
      await new Promise(function(r) { setTimeout(r, 200) })
    }

    return new Response(JSON.stringify({
      ok: true,
      total: leads.length,
      atualizados: atualizados,
      nao_encontrados: nao_encontrados
    }), { status: 200 })

  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e) }), { status: 500 })
  }
})