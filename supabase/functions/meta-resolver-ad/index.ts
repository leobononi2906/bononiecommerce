// Resolve ad_id -> anuncio/conjunto/campanha via Graph API e grava em meta_ad_cache.
// POST {} = resolve os pendentes (campaign_name null) do cache. {ad_ids:[...]} = resolve esses. {todos:true} = re-resolve tudo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TOKEN = Deno.env.get("META_ACCESS_TOKEN");
const cors = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, apikey, content-type" };
const json = (o:any,s=200)=> new Response(JSON.stringify(o),{status:s,headers:{...cors,"Content-Type":"application/json"}});

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

Deno.serve(async (req) => {
  if (req.method !== "OPTIONS" && !(await chamadaAutorizada(req))) {
    return new Response(JSON.stringify({ erro: "não autorizado" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  try{
    if(!TOKEN) return json({error:"META_ACCESS_TOKEN nao configurado"},500);
    const body = await req.json().catch(()=>({}));
    let ids:string[] = Array.isArray(body.ad_ids) ? body.ad_ids : [];
    if(!ids.length){
      let q = sb.from("meta_ad_cache").select("ad_id");
      if(!body.todos) q = q.is("campaign_name", null);
      const { data } = await q.limit(200);
      ids = (data||[]).map((r:any)=> r.ad_id);
    }
    let ok=0, err=0; const amostra:any[] = [];
    for(const ad_id of ids){
      try{
        const url = `https://graph.facebook.com/v19.0/${ad_id}?fields=name,adset{name},campaign{name}&access_token=${TOKEN}`;
        const r = await fetch(url); const d = await r.json();
        if(d.error){ err++; if(amostra.length<3) amostra.push({ad_id, erro:d.error.message}); continue; }
        const row = { ad_id, ad_name:d.name||null, adset_name:d.adset?.name||null, campaign_name:d.campaign?.name||null, atualizado_em:new Date().toISOString() };
        await sb.from("meta_ad_cache").upsert(row, { onConflict:"ad_id" });
        ok++; if(amostra.length<3) amostra.push(row);
      }catch(e){ err++; }
      await new Promise(r=>setTimeout(r,150));
    }
    return json({ ok:true, resolvidos:ok, erros:err, total:ids.length, amostra });
  }catch(e){ return json({error:String(e)},500); }
});
