-- 20261023120000_ecom_jornada.sql
-- aplicada em produção em 2026-10-23 (7 etapas, 4 funções, RLS ligada nas 4 tabelas, anon sem acesso)
-- ⚠ NÃO REAPLICAR: a migration 20261023140000_mkt_acesso (repo bononi-marketing) redefiniu
--   ecom_jornada_pode_ler() para aceitar também o módulo 'marketing'. Rodar este arquivo de novo
--   volta a função só para 'ecommerce' e tira o acesso do app Marketing.
--
-- Por quê: substituir a jornada do Tintim por uma própria (plano em docs/2026-10-23-plano-jornada-propria.md,
-- Fase 1). A etapa de cada lead do WhatsApp do e-commerce passa a nascer do que já chega ao banco:
-- mensagem do cliente, 1ª resposta do atendente, etiqueta da Umbler e venda no SGA.
--
-- O que faz:
--   1. Cria 4 tabelas novas:
--      ecom_jornada_etapa      as 7 etapas (mesmos nomes e eventos do Tintim);
--      ecom_jornada_lead       um registro por telefone (chave_tel = DDD + 8 últimos dígitos);
--      ecom_jornada_historico  cada mudança de etapa (é o que a Fase 2 vai mandar ao Meta);
--      ecom_jornada_controle   canais monitorados e até onde a rotina já leu.
--   2. Cria ecom_chave_tel(), ecom_jornada_mover() e ecom_jornada_processar().
--   3. RLS ligada nas 4 tabelas: lê quem tem o módulo 'ecommerce' (ou é admin); ninguém logado grava.
--      Quem grava é só a rotina (service_role / cron).
--
-- O que NÃO faz: não apaga nem altera dado existente; só LÊ umbler_eventos, umbler_lead_origem e
-- ecom_atd_funil. Não agenda o cron (vai em arquivo próprio depois do ensaio) e não manda nada ao Meta.
--
-- Regras de etapa (Fase 0, 81% de concordância com o Tintim):
--   lead nasce na 1ª mensagem do CLIENTE (Source = Contact) num canal monitorado → NOVO CONTATO,
--     ou JÁ É CLIENTE se o telefone já tem venda no SGA antes disso;
--   1ª mensagem de atendente (Source = Member) → EM ATENDIMENTO (só a partir de NOVO CONTATO);
--   quando entra etiqueta nova (da conversa ou do contato), a etapa sai do conjunto atual, por prioridade:
--     DESQUALIFICADO* → DESQUALIFICADO; SEM RESPOSTA / NÃO RESPONDEU → SEM RESPOSTA;
--     INTERESSADO* → EM NEGOCIAÇÃO; QUALIFICADO → EM ATENDIMENTO (só a partir de NOVO CONTATO);
--     INTERESSADO e DESQUALIFICADO são etiquetas do CONTATO: não geram ChatTagChanged, vêm em toda mensagem;
--   venda no SGA (ecom_atd_funil.comprou_erp) com data >= 1ª mensagem → COMPRA (final, com o valor).
--
-- Como volta: bloco REVERTER no fim (as tabelas são novas; derrubá-las não toca em nada existente).

-- ---------------------------------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------------------------------
create table if not exists public.ecom_jornada_etapa (
  id                 smallint primary key,
  nome               text not null unique,
  ordem              smallint not null,
  evento_meta        text,                       -- null = não manda evento
  e_venda            boolean not null default false,
  e_primeiro_contato boolean not null default false,
  final              boolean not null default false,  -- etapa de onde não se sai (COMPRA)
  regra              text not null,
  ativo              boolean not null default true,
  atualizado_em      timestamptz not null default now()
);

insert into public.ecom_jornada_etapa (id, nome, ordem, evento_meta, e_venda, e_primeiro_contato, final, regra) values
  (1, 'NOVO CONTATO',   1, 'Contact',           false, true,  false, '1ª mensagem do cliente num canal monitorado'),
  (2, 'EM ATENDIMENTO', 2, 'Lead',              false, false, false, '1ª resposta de atendente, ou etiqueta QUALIFICADO'),
  (3, 'EM NEGOCIAÇÃO',  3, 'InitiateCheckout',  false, false, false, 'etiqueta INTERESSADO* adicionada'),
  (4, 'COMPRA',         4, 'Purchase',          true,  false, true,  'venda no SGA casada pelo telefone'),
  (5, 'SEM RESPOSTA',   5, 'SubmitApplication', false, false, false, 'etiqueta SEM RESPOSTA ou NÃO RESPONDEU adicionada'),
  (6, 'DESQUALIFICADO', 6, 'ViewContent',       false, false, false, 'etiqueta DESQUALIFICADO* adicionada'),
  (7, 'JÁ É CLIENTE',   7, null,                false, false, false, 'telefone com venda no SGA antes da 1ª mensagem')
on conflict (id) do nothing;

create table if not exists public.ecom_jornada_lead (
  chave_tel            text primary key,
  telefone             text not null,
  nome                 text,
  id_conversa          text,
  canal                text,
  etapa_id             smallint not null references public.ecom_jornada_etapa(id) on delete restrict,
  etapa_desde          timestamptz not null,
  primeira_msg_em      timestamptz not null,
  primeira_resposta_em timestamptz,
  ultima_msg_em        timestamptz,
  tags_umbler          text[] not null default '{}',   -- foto das etiquetas, para achar a que foi adicionada
  ad_id                text,
  ctwa_clid            text,
  venda_em             date,
  venda_valor          numeric(14,2),
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);
create index if not exists ecom_jornada_lead_etapa_idx on public.ecom_jornada_lead (etapa_id);
create index if not exists ecom_jornada_lead_primeira_idx on public.ecom_jornada_lead (primeira_msg_em desc);

create table if not exists public.ecom_jornada_historico (
  id            bigint generated always as identity primary key,
  chave_tel     text not null references public.ecom_jornada_lead(chave_tel) on delete restrict,
  de_etapa_id   smallint references public.ecom_jornada_etapa(id) on delete restrict,
  para_etapa_id smallint not null references public.ecom_jornada_etapa(id) on delete restrict,
  motivo        text not null check (motivo in ('automatico', 'manual', 'sga')),
  gatilho       text not null,
  feito_por     uuid,
  ocorrido_em   timestamptz not null,
  evento_meta   text,
  valor         numeric(14,2),
  capi          text not null default 'pendente' check (capi in ('pendente', 'historico', 'sem_evento')),
  criado_em     timestamptz not null default now()
);
create index if not exists ecom_jornada_hist_lead_idx on public.ecom_jornada_historico (chave_tel, ocorrido_em);
create index if not exists ecom_jornada_hist_pendente_idx on public.ecom_jornada_historico (ocorrido_em) where capi = 'pendente';

create table if not exists public.ecom_jornada_controle (
  chave         text primary key,
  valor         text not null,
  atualizado_em timestamptz not null default now()
);
insert into public.ecom_jornada_controle (chave, valor) values ('canais', 'OFICIAL LV')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Funções
-- ---------------------------------------------------------------------------------------------
-- Mesma chave da ecom_atd_funil.chave_tel (conferido: 40.778 de 40.778 iguais).
create or replace function public.ecom_chave_tel(p_tel text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select case when length(d2) >= 10 then left(d2, 2) || right(d2, 8) end
  from (select case when length(d) >= 12 and left(d, 2) = '55' then substr(d, 3) else d end as d2
        from (select regexp_replace(coalesce(p_tel, ''), '\D', '', 'g') as d) a) b;
$function$;

-- Move um lead de etapa e grava o histórico. Devolve true se mudou.
create or replace function public.ecom_jornada_mover(
  p_chave text, p_para smallint, p_motivo text, p_gatilho text, p_quando timestamptz,
  p_valor numeric default null, p_historico boolean default false, p_feito_por uuid default null)
returns boolean
language plpgsql
set search_path to 'public'
as $function$
declare
  v_atual  smallint;
  v_final  boolean;
  v_evento text;
begin
  select l.etapa_id, e.final into v_atual, v_final
  from ecom_jornada_lead l join ecom_jornada_etapa e on e.id = l.etapa_id
  where l.chave_tel = p_chave
  for update of l;

  if v_atual is null or v_atual = p_para or coalesce(v_final, false) or p_para = 1 then
    return false;
  end if;

  select evento_meta into v_evento from ecom_jornada_etapa where id = p_para and ativo;

  update ecom_jornada_lead
     set etapa_id = p_para, etapa_desde = p_quando, atualizado_em = now()
   where chave_tel = p_chave;

  insert into ecom_jornada_historico
    (chave_tel, de_etapa_id, para_etapa_id, motivo, gatilho, feito_por, ocorrido_em, evento_meta, valor, capi)
  values
    (p_chave, v_atual, p_para, p_motivo, p_gatilho, p_feito_por, p_quando, v_evento, p_valor,
     case when v_evento is null then 'sem_evento' when p_historico then 'historico' else 'pendente' end);
  return true;
end;
$function$;

-- Lê o que chegou da Umbler desde a última rodada e avança as etapas.
-- p_historico = true na carga inicial: o histórico nasce como 'historico' e não vai ao Meta.
create or replace function public.ecom_jornada_processar(
  p_desde timestamptz default null, p_ate timestamptz default now(), p_historico boolean default false)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_desde    timestamptz;
  v_canais   text[];
  v_novos    int := 0;
  v_resposta int := 0;
  v_tag      int := 0;
  v_venda    int := 0;
  v_eventos  int := 0;
  r          record;
  v_novas    text[];
  v_para     smallint;
  v_atual    smallint;
begin
  v_desde := coalesce(p_desde,
                      (select valor::timestamptz from ecom_jornada_controle where chave = 'processado_ate'),
                      p_ate - interval '1 day');
  select string_to_array(valor, ',') into v_canais from ecom_jornada_controle where chave = 'canais';

  drop table if exists _jornada_ev;
  create temp table _jornada_ev on commit drop as
  select e.id,
         e.tipo,
         ecom_chave_tel(coalesce(e.telefone, c -> 'Contact' ->> 'PhoneNumber')) as k,
         coalesce(e.telefone, c -> 'Contact' ->> 'PhoneNumber') as tel,
         c -> 'Contact' ->> 'Name' as nome,
         e.id_conversa,
         coalesce(e.nome_canal, c -> 'Channel' ->> 'Name') as canal,
         case when e.tipo = 'Message'
              then coalesce((c -> 'LastMessage' ->> 'EventAtUTC')::timestamptz, (c ->> 'EventAtUTC')::timestamptz, e.recebido_em)
              else coalesce((c ->> 'EventAtUTC')::timestamptz, e.recebido_em) end as quando,
         c -> 'LastMessage' ->> 'Source' as fonte,
         -- etiquetas da conversa (SEM RESPOSTA, QUALIFICADO…) + do contato (INTERESSADO LV, DESQUALIFICADO LV…),
         -- em ordem, para comparar com a foto anterior; vêm em todo evento, não só no ChatTagChanged
         array(select distinct t ->> 'Name'
               from jsonb_array_elements(coalesce(c -> 'Tags', '[]'::jsonb) || coalesce(c -> 'Contact' -> 'Tags', '[]'::jsonb)) t
               where t ->> 'Name' is not null
               order by 1) as tags
  from umbler_eventos e
  cross join lateral (select e.payload -> 'Payload' -> 'Content' as c) x
  where e.recebido_em > v_desde and e.recebido_em <= p_ate
    and e.tipo in ('Message', 'ChatTagChanged')
    and coalesce(e.nome_canal, c -> 'Channel' ->> 'Name') = any(v_canais);
  get diagnostics v_eventos = row_count;

  -- (1) lead novo: 1ª mensagem do cliente
  with prim as (
    select distinct on (k) k, tel, nome, id_conversa, canal, quando
    from _jornada_ev
    where tipo = 'Message' and fonte = 'Contact' and k is not null
    order by k, quando
  ), origem as (
    select distinct on (ecom_chave_tel(telefone)) ecom_chave_tel(telefone) as k, ad_id, ctwa_clid
    from umbler_lead_origem
    order by ecom_chave_tel(telefone), primeiro_evento_em desc nulls last
  ), primeira_venda as (
    select chave_tel as k, min(dt_venda) as dt from ecom_atd_funil where comprou_erp group by chave_tel
  ), novos as (
    insert into ecom_jornada_lead (chave_tel, telefone, nome, id_conversa, canal, etapa_id, etapa_desde,
                                   primeira_msg_em, ultima_msg_em, ad_id, ctwa_clid)
    select p.k, p.tel, p.nome, p.id_conversa, p.canal,
           case when pv.dt < p.quando::date then 7 else 1 end,
           p.quando, p.quando, p.quando, o.ad_id, o.ctwa_clid
    from prim p
    left join origem o on o.k = p.k
    left join primeira_venda pv on pv.k = p.k
    where not exists (select 1 from ecom_jornada_lead l where l.chave_tel = p.k)
    returning chave_tel, etapa_id, primeira_msg_em
  )
  insert into ecom_jornada_historico (chave_tel, de_etapa_id, para_etapa_id, motivo, gatilho, ocorrido_em, evento_meta, capi)
  select n.chave_tel, null, n.etapa_id, 'automatico', '1ª mensagem do cliente', n.primeira_msg_em, e.evento_meta,
         case when e.evento_meta is null then 'sem_evento' when p_historico then 'historico' else 'pendente' end
  from novos n join ecom_jornada_etapa e on e.id = n.etapa_id;
  get diagnostics v_novos = row_count;

  -- última mensagem e conversa mais recente
  update ecom_jornada_lead l
     set ultima_msg_em = greatest(l.ultima_msg_em, u.ult), id_conversa = coalesce(u.conv, l.id_conversa),
         atualizado_em = now()
  from (select k, max(quando) as ult, (array_agg(id_conversa order by quando desc))[1] as conv
        from _jornada_ev where tipo = 'Message' and k is not null group by k) u
  where u.k = l.chave_tel;

  -- (2) 1ª resposta do atendente
  for r in
    select l.chave_tel, min(ev.quando) as quando
    from ecom_jornada_lead l
    join _jornada_ev ev on ev.k = l.chave_tel and ev.tipo = 'Message' and ev.fonte = 'Member'
                       and ev.quando >= l.primeira_msg_em
    where l.primeira_resposta_em is null
    group by l.chave_tel
  loop
    update ecom_jornada_lead set primeira_resposta_em = r.quando where chave_tel = r.chave_tel;
    if (select etapa_id from ecom_jornada_lead where chave_tel = r.chave_tel) = 1 then
      if ecom_jornada_mover(r.chave_tel, 2::smallint, 'automatico', '1ª resposta do atendente', r.quando,
                            null, p_historico) then
        v_resposta := v_resposta + 1;
      end if;
    end if;
  end loop;

  -- (3) etiqueta adicionada na Umbler, em ordem de tempo; só os eventos em que a lista mudou
  for r in
    select z.k, z.quando, z.tags
    from (select ev.k, ev.quando, ev.id, ev.tags,
                 lag(ev.tags) over (partition by ev.k order by ev.quando, ev.id) as anterior
          from _jornada_ev ev
          where exists (select 1 from ecom_jornada_lead l where l.chave_tel = ev.k)) z
    where z.anterior is distinct from z.tags
    order by z.quando, z.id
  loop
    select array(select unnest(r.tags) except select unnest(l.tags_umbler)), l.etapa_id
      into v_novas, v_atual
    from ecom_jornada_lead l where l.chave_tel = r.k;

    update ecom_jornada_lead set tags_umbler = coalesce(r.tags, '{}') where chave_tel = r.k;

    -- A etapa sai do CONJUNTO atual de etiquetas, por prioridade, sempre que ele muda. Ensaio de 23/10
    -- contra o Tintim: prioridade sobre o conjunto = 81%; "a etiqueta recém-adicionada vence" = 71%;
    -- "SEM RESPOSTA não tira da negociação" = 63%.
    v_para := null;
    if exists (select 1 from unnest(r.tags) t where t ilike 'DESQUALIFICADO%') then
      v_para := 6;
    elsif exists (select 1 from unnest(r.tags) t where t in ('SEM RESPOSTA', 'NÃO RESPONDEU')) then
      v_para := 5;
    elsif exists (select 1 from unnest(r.tags) t where t ilike 'INTERESSADO%') then
      v_para := 3;
    elsif 'QUALIFICADO' = any(r.tags) and v_atual = 1 then
      v_para := 2;
    end if;
    if cardinality(v_novas) = 0 then
      v_para := null;  -- só saiu etiqueta: não move
    end if;

    if v_para is not null
       and ecom_jornada_mover(r.k, v_para, 'automatico',
                              'etiqueta ' || array_to_string(v_novas, ', '), r.quando, null, p_historico) then
      v_tag := v_tag + 1;
    end if;
  end loop;

  -- (4) venda no SGA depois da 1ª mensagem → COMPRA (olha todos os leads, não só a janela)
  for r in
    select distinct on (l.chave_tel) l.chave_tel, f.dt_venda, f.valor_venda_erp
    from ecom_jornada_lead l
    join ecom_atd_funil f on f.chave_tel = l.chave_tel
    where l.etapa_id <> 4 and f.comprou_erp and f.dt_venda >= l.primeira_msg_em::date
    order by l.chave_tel, f.dt_venda
  loop
    update ecom_jornada_lead set venda_em = r.dt_venda, venda_valor = r.valor_venda_erp where chave_tel = r.chave_tel;
    if ecom_jornada_mover(r.chave_tel, 4::smallint, 'sga', 'venda no SGA',
                          (r.dt_venda::timestamp + interval '12 hours') at time zone 'America/Sao_Paulo',
                          r.valor_venda_erp, p_historico) then
      v_venda := v_venda + 1;
    end if;
  end loop;

  insert into ecom_jornada_controle (chave, valor, atualizado_em) values ('processado_ate', p_ate::text, now())
  on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

  return jsonb_build_object('desde', v_desde, 'ate', p_ate, 'eventos_lidos', v_eventos,
                            'leads_novos', v_novos, 'mov_resposta', v_resposta,
                            'mov_etiqueta', v_tag, 'mov_venda', v_venda);
end;
$function$;

revoke all on function public.ecom_jornada_mover(text, smallint, text, text, timestamptz, numeric, boolean, uuid) from public, anon, authenticated;
revoke all on function public.ecom_jornada_processar(timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.ecom_jornada_mover(text, smallint, text, text, timestamptz, numeric, boolean, uuid) to service_role;
grant execute on function public.ecom_jornada_processar(timestamptz, timestamptz, boolean) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. Acesso: só leitura para o módulo 'ecommerce'; ninguém logado grava (Fase 3 traz a troca manual por RPC)
-- ---------------------------------------------------------------------------------------------
-- Própria desta migration: a ecom_leads_pode_ler() da 20261006140000 nunca foi aplicada em produção.
create or replace function public.ecom_jornada_pode_ler()
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  select coalesce(auth.jwt() -> 'user_metadata' ->> 'admin', '') = 'true'
      or coalesce((auth.jwt() -> 'user_metadata' -> 'modulos') ? 'ecommerce', false)
      or coalesce((auth.jwt() -> 'user_metadata' -> 'admin_modulos') ? 'ecommerce', false);
$function$;
revoke all on function public.ecom_jornada_pode_ler() from public, anon;
grant execute on function public.ecom_jornada_pode_ler() to authenticated, service_role;

alter table public.ecom_jornada_etapa     enable row level security;
alter table public.ecom_jornada_lead      enable row level security;
alter table public.ecom_jornada_historico enable row level security;
alter table public.ecom_jornada_controle  enable row level security;

drop policy if exists ecom_jornada_etapa_le on public.ecom_jornada_etapa;
drop policy if exists ecom_jornada_lead_le on public.ecom_jornada_lead;
drop policy if exists ecom_jornada_historico_le on public.ecom_jornada_historico;
create policy ecom_jornada_etapa_le     on public.ecom_jornada_etapa     for select to authenticated using (public.ecom_jornada_pode_ler());
create policy ecom_jornada_lead_le      on public.ecom_jornada_lead      for select to authenticated using (public.ecom_jornada_pode_ler());
create policy ecom_jornada_historico_le on public.ecom_jornada_historico for select to authenticated using (public.ecom_jornada_pode_ler());
-- ecom_jornada_controle: RLS sem policy = fechada para anon e authenticated.

revoke all on public.ecom_jornada_etapa, public.ecom_jornada_lead, public.ecom_jornada_historico,
              public.ecom_jornada_controle from anon;
revoke insert, update, delete, truncate, references, trigger
    on public.ecom_jornada_etapa, public.ecom_jornada_lead, public.ecom_jornada_historico,
       public.ecom_jornada_controle from authenticated;

-- REVERTER:
--   drop function public.ecom_jornada_processar(timestamptz, timestamptz, boolean);
--   drop function public.ecom_jornada_mover(text, smallint, text, text, timestamptz, numeric, boolean, uuid);
--   drop function public.ecom_chave_tel(text);
--   drop function public.ecom_jornada_pode_ler();
--   drop table public.ecom_jornada_historico;
--   drop table public.ecom_jornada_lead;
--   drop table public.ecom_jornada_controle;
--   drop table public.ecom_jornada_etapa;
