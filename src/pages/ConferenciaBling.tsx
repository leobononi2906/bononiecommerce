import React, { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, Square, AlertTriangle, Check, History, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { fmtBRLFull, fmtNum } from '../lib/fmt'
import { supabase } from '../lib/supabase'
import type { Periodo } from '../types'

const FUNC_URL =
  (import.meta.env.VITE_SUPABASE_URL ?? 'https://vishxwdxqiygbxmtpfoy.supabase.co') +
  '/functions/v1/bling-sync'

// ── Tipos ──────────────────────────────────────────────────────────────────
type Item = {
  sku: string; codigo: string; nome: string; id_bling: number; id_produto: number | null
  achou: boolean; sincronizar: boolean
  precoManual: number | string | null; estoqueManual: number | string | null
  precoErp: number | null; estErp: number | null
  precoBling: number | null; estBling: number | null
  mudaPreco: boolean; mudaEstoque: boolean
}
type Filtro = 'todos' | 'divergentes' | 'preco' | 'estoque' | 'nao' | 'manual'
type LogRow = {
  id: number; executado_em: string; modo: string
  total_bling: number; nao_encontrados: number
  preco_alterados: number; estoque_alterados: number; erros: number
  duracao_seg: number; concluido: boolean
  detalhes: any[]
}
type Aba = 'conferencia' | 'historico' | 'sync'

// ── Helpers ────────────────────────────────────────────────────────────────
const C = {
  blueDark: 'var(--blue-dark)', blueMid: 'var(--blue-mid)', surface: 'var(--surface)', border: 'var(--border)',
  txt: 'var(--text-primary)', muted: 'var(--text-muted)', hint: 'var(--text-hint)',
  green: 'var(--green)', greenBg: 'var(--green-bg)', red: 'var(--red)', redBg: 'var(--red-bg)',
  amber: 'var(--amber)', amberBg: 'var(--amber-bg)', radius: 'var(--radius)', radiusLg: 'var(--radius-lg)',
}
const font = { fontFamily: 'DM Sans, sans-serif' }
const numOrNull = (v: number | string | null) =>
  v === '' || v == null ? null : (isNaN(Number(v)) ? null : Number(v))
const fmtDt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

function envioDe(it: Item) {
  return {
    preco: it.sincronizar ? it.precoErp : numOrNull(it.precoManual),
    est: it.sincronizar ? it.estErp : numOrNull(it.estoqueManual),
  }
}
function statusDe(it: Item) {
  if (!it.achou) return { bg: '#EEF0F4', fg: C.hint, txt: 'Sem par' }
  if (!it.sincronizar) return { bg: '#EEF2FF', fg: C.blueDark, txt: 'Manual' }
  if (it.mudaPreco && it.mudaEstoque) return { bg: C.redBg, fg: C.red, txt: 'Preço+Estoque' }
  if (it.mudaPreco) return { bg: C.amberBg, fg: C.amber, txt: 'Preço difere' }
  if (it.mudaEstoque) return { bg: C.amberBg, fg: C.amber, txt: 'Estoque difere' }
  return { bg: C.greenBg, fg: C.green, txt: 'OK' }
}

// ── Componente Principal ───────────────────────────────────────────────────
export default function ConferenciaBling(_props: { periodo?: Periodo }) {
  const [aba, setAba] = useState<Aba>('conferencia')

  // Conferência
  const [dados, setDados] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [paginas, setPaginas] = useState(0)
  const [salvo, setSalvo] = useState<number | null>(null)
  const pararRef = useRef(false)

  // Histórico
  const [log, setLog] = useState<LogRow[]>([])
  const [logCarregando, setLogCarregando] = useState(false)
  const [expandido, setExpandido] = useState<number | null>(null)

  // Sync manual
  const [syncRodando, setSyncRodando] = useState(false)
  const [syncResultado, setSyncResultado] = useState<any>(null)
  const [syncErro, setSyncErro] = useState<string | null>(null)

  useEffect(() => { if (aba === 'historico') carregarLog() }, [aba])

  const resumo = useMemo(() => ({
    total: dados.length,
    ok: dados.filter(d => d.achou && d.sincronizar && !d.mudaPreco && !d.mudaEstoque).length,
    preco: dados.filter(d => d.achou && d.mudaPreco).length,
    estoque: dados.filter(d => d.achou && d.mudaEstoque).length,
    manual: dados.filter(d => d.achou && !d.sincronizar).length,
    nao: dados.filter(d => !d.achou).length,
  }), [dados])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(it => {
      if (filtro === 'divergentes' && !(it.mudaPreco || it.mudaEstoque || !it.achou)) return false
      if (filtro === 'preco' && !it.mudaPreco) return false
      if (filtro === 'estoque' && !it.mudaEstoque) return false
      if (filtro === 'nao' && it.achou) return false
      if (filtro === 'manual' && (it.sincronizar || !it.achou)) return false
      if (q && !((it.sku || '').toLowerCase().includes(q) || (it.nome || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [dados, filtro, busca])

  // ── Conferência ───────────────────────────────────────────────────────────
  async function carregar() {
    pararRef.current = false
    setCarregando(true); setErro(null); setDados([]); setPaginas(0)
    let pagina = 1; const acc: Item[] = []
    try {
      while (true) {
        if (pararRef.current) break
        const r = await fetch(`${FUNC_URL}?acao=conferir&pagina=${pagina}`)
        const j = await r.json()
        if (j.erro) throw new Error(j.erro)
        acc.push(...(j.itens ?? [])); setDados([...acc]); setPaginas(pagina)
        if (j.concluido || !j.proxima_pagina) break
        pagina = j.proxima_pagina
      }
    } catch (e: any) { setErro(e?.message ?? String(e)) }
    finally { setCarregando(false) }
  }

  async function salvarOverride(it: Item) {
    if (it.id_produto == null) return
    try {
      const { error } = await supabase.from('bling_sync_overrides').upsert({
        id_produto: it.id_produto, sincronizar: it.sincronizar,
        preco_manual: it.sincronizar ? null : numOrNull(it.precoManual),
        estoque_manual: it.sincronizar ? null : numOrNull(it.estoqueManual),
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'id_produto' })
      if (error) throw error
      setSalvo(it.id_produto); setTimeout(() => setSalvo(s => s === it.id_produto ? null : s), 1200)
    } catch (e: any) { setErro(`Falha ao salvar ${it.sku}: ${e?.message ?? e}`) }
  }

  function patch(id_bling: number, campos: Partial<Item>, persistir = false) {
    setDados(ds => {
      const novo = ds.map(d => d.id_bling === id_bling ? { ...d, ...campos } : d)
      if (persistir) { const it = novo.find(d => d.id_bling === id_bling); if (it) salvarOverride(it) }
      return novo
    })
  }

  // ── Histórico ─────────────────────────────────────────────────────────────
  async function carregarLog() {
    setLogCarregando(true)
    try {
      const { data, error } = await supabase
        .from('bling_sync_log')
        .select('*')
        .order('id', { ascending: false })
        .range(0, 49)
      if (error) throw error
      setLog(data ?? [])
    } catch (e: any) { setErro(e?.message ?? String(e)) }
    finally { setLogCarregando(false) }
  }

  // ── Sync Manual ───────────────────────────────────────────────────────────
  async function rodarSync(modo: 'dryrun' | 'real') {
    setSyncRodando(true); setSyncResultado(null); setSyncErro(null)
    try {
      const r = await fetch(`${FUNC_URL}?acao=sync&modo=${modo}`)
      const j = await r.json()
      if (j.erro) throw new Error(j.erro)
      setSyncResultado(j)
      if (aba === 'historico') carregarLog()
    } catch (e: any) { setSyncErro(e?.message ?? String(e)) }
    finally { setSyncRodando(false) }
  }

  // ── Estilos ───────────────────────────────────────────────────────────────
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', background: C.blueDark, color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', position: 'sticky', top: 0, whiteSpace: 'nowrap', ...font }
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 13, whiteSpace: 'nowrap', ...font }
  const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
  const inp: React.CSSProperties = { width: 92, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 7px', fontSize: 12.5, textAlign: 'right', ...font }

  const card = (n: string | number, label: string, fg: string) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: fg, ...font }}>{n}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, ...font }}>{label}</div>
    </div>
  )

  const segBtn = (f: Filtro, label: string) => (
    <button onClick={() => setFiltro(f)} style={{ padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, background: filtro === f ? C.surface : 'transparent', color: filtro === f ? C.blueDark : C.muted, boxShadow: filtro === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', ...font }}>{label}</button>
  )

  const abaBtn = (id: Aba, label: string, icon: React.ReactNode) => (
    <button onClick={() => setAba(id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderBottom: aba === id ? `2px solid ${C.blueDark}` : '2px solid transparent', background: 'transparent', color: aba === id ? C.blueDark : C.muted, fontWeight: aba === id ? 700 : 400, fontSize: 13, cursor: 'pointer', ...font }}>
      {icon}{label}
    </button>
  )

  return (
    <div style={{ padding: 24, ...font }}>

      {/* Cabeçalho */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.blueDark }}>Bling × ERP — Conferência & Sync</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
          Confira divergências, defina valores manuais e acompanhe o histórico de sincronizações.
        </div>
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginBottom: 20, gap: 0 }}>
        {abaBtn('conferencia', 'Conferência', <Search size={13} />)}
        {abaBtn('sync', 'Executar Sync', <Play size={13} />)}
        {abaBtn('historico', 'Histórico', <History size={13} />)}
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redBg, color: C.red, border: '1px solid #F5C2C2', borderRadius: C.radius, padding: '11px 14px', marginBottom: 14, fontSize: 13 }}>
          <AlertTriangle size={15} /> {erro}
          <button onClick={() => setErro(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      {/* ── ABA CONFERÊNCIA ── */}
      {aba === 'conferencia' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={carregando ? () => { pararRef.current = true } : carregar} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: C.radius, border: 'none', background: carregando ? C.amber : C.blueMid, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...font }}>
              {carregando ? <><Square size={14} /> Parar (pág. {paginas})</> : <><RefreshCw size={14} /> Carregar / Atualizar</>}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 16 }}>
            {card(fmtNum(resumo.total), 'Produtos', C.blueMid)}
            {card(fmtNum(resumo.ok), 'OK', C.green)}
            {card(fmtNum(resumo.preco), 'Preço difere', C.amber)}
            {card(fmtNum(resumo.estoque), 'Estoque difere', C.amber)}
            {card(fmtNum(resumo.manual), 'Manuais', C.blueDark)}
            {card(fmtNum(resumo.nao), 'Sem par ERP', C.red)}
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-flex', background: '#F1F5F9', border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 3, gap: 2 }}>
              {segBtn('todos', 'Todos')}{segBtn('divergentes', 'Divergentes')}{segBtn('preco', 'Preço')}{segBtn('estoque', 'Estoque')}{segBtn('manual', 'Manuais')}{segBtn('nao', 'Sem par')}
            </div>
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.hint }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por SKU ou nome…" style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '9px 12px 9px 32px', fontSize: 13, background: C.surface, ...font }} />
            </div>
          </div>

          <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusLg, overflow: 'hidden', background: C.surface }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'center' }}>Sinc.</th>
                  <th style={th}>SKU</th>
                  <th style={th}>Produto</th>
                  <th style={{ ...th, textAlign: 'right' }}>Preço ERP/manual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Preço Bling</th>
                  <th style={{ ...th, textAlign: 'right' }}>Estoque ERP/manual</th>
                  <th style={{ ...th, textAlign: 'right' }}>Est. Bling</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.length === 0 ? (
                  <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.muted, padding: 40 }}>
                    {carregando ? 'Carregando…' : dados.length ? 'Nada com esse filtro.' : 'Clique em "Carregar / Atualizar".'}
                  </td></tr>
                ) : lista.map(it => {
                  const st = statusDe(it)
                  return (
                    <tr key={it.id_bling} style={{ background: it.mudaPreco || it.mudaEstoque ? 'rgba(245,158,11,0.03)' : undefined }}>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <input type="checkbox" disabled={!it.achou} checked={it.sincronizar}
                          onChange={e => patch(it.id_bling, { sincronizar: e.target.checked }, true)}
                          style={{ width: 16, height: 16, cursor: it.achou ? 'pointer' : 'default', accentColor: '#1A3A8F' }} />
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: C.blueDark }}>
                        {it.sku || '—'}{salvo === it.id_produto && <Check size={13} color={'var(--green)'} style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                      </td>
                      <td style={{ ...td, whiteSpace: 'normal', maxWidth: 260 }}>{it.nome}</td>
                      <td style={tdNum}>
                        {it.sincronizar
                          ? (it.precoErp == null ? '—' : fmtBRLFull(it.precoErp))
                          : <input type="number" step="0.01" value={it.precoManual ?? ''} placeholder="manual"
                              onChange={e => patch(it.id_bling, { precoManual: e.target.value })}
                              onBlur={() => patch(it.id_bling, {}, true)} style={inp} />}
                      </td>
                      <td style={{ ...tdNum, color: it.mudaPreco ? C.amber : C.txt }}>{it.precoBling == null ? '—' : fmtBRLFull(it.precoBling)}</td>
                      <td style={tdNum}>
                        {it.sincronizar
                          ? (it.estErp == null ? '—' : fmtNum(it.estErp))
                          : <input type="number" step="1" value={it.estoqueManual ?? ''} placeholder="manual"
                              onChange={e => patch(it.id_bling, { estoqueManual: e.target.value })}
                              onBlur={() => patch(it.id_bling, {}, true)} style={inp} />}
                      </td>
                      <td style={{ ...tdNum, color: it.mudaEstoque ? C.amber : C.txt }}>{it.estBling == null ? '—' : fmtNum(it.estBling)}</td>
                      <td style={td}><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.txt}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ABA SYNC ── */}
      {aba === 'sync' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radiusLg, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Simulação (Dry-run)</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Mostra o que seria alterado <strong>sem</strong> escrever nada no Bling. Use para conferir antes de rodar de verdade.</div>
            <button onClick={() => rodarSync('dryrun')} disabled={syncRodando} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: C.radius, border: `1px solid ${C.border}`, background: C.surface, color: C.blueDark, fontWeight: 700, fontSize: 13, cursor: syncRodando ? 'not-allowed' : 'pointer', ...font }}>
              <Play size={14} /> {syncRodando ? 'Rodando…' : 'Rodar Dry-run'}
            </button>
          </div>

          <div style={{ background: C.surface, border: `2px solid ${C.amber}`, borderRadius: C.radiusLg, padding: 24, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 8 }}>Sync Real</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Atualiza preços e estoques <strong>de verdade</strong> no Bling. Garanta que conferiu os dados antes.</div>
            <button onClick={() => rodarSync('real')} disabled={syncRodando} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: C.radius, border: 'none', background: syncRodando ? C.hint : C.amber, color: '#fff', fontWeight: 700, fontSize: 13, cursor: syncRodando ? 'not-allowed' : 'pointer', ...font }}>
              <RefreshCw size={14} /> {syncRodando ? 'Sincronizando…' : 'Rodar Sync Real'}
            </button>
          </div>

          {syncErro && (
            <div style={{ background: C.redBg, color: C.red, border: `1px solid #F5C2C2`, borderRadius: C.radius, padding: '12px 16px', fontSize: 13 }}>
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{syncErro}
            </div>
          )}

          {syncResultado && (
            <div style={{ background: C.greenBg, border: `1px solid #BBF7D0`, borderRadius: C.radiusLg, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.green, marginBottom: 12 }}>✅ Sync concluído — modo {syncResultado.modo}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['Total Bling', syncResultado.total_bling],
                  ['Não encontrados', syncResultado.nao_encontrados],
                  ['Preços alterados', syncResultado.preco_alterados],
                  ['Estoques alterados', syncResultado.estoque_alterados],
                  ['Erros', syncResultado.erros],
                  ['Duração', `${syncResultado.duracao_seg}s`],
                ].map(([l, v]) => (
                  <div key={String(l)} style={{ fontSize: 13, ...font }}>
                    <span style={{ color: C.muted }}>{l}: </span>
                    <strong style={{ color: C.txt }}>{v}</strong>
                  </div>
                ))}
              </div>
              {syncResultado.detalhes?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: 'uppercase' }}>Detalhes</div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', background: 'rgba(0,0,0,0.03)', borderRadius: 8, padding: 10 }}>
                    {syncResultado.detalhes.map((d: any, i: number) => (
                      <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', color: d.erro ? C.red : C.txt, ...font }}>
                        <strong>{d.sku}</strong> — {d.campo ?? d.status}
                        {d.de != null && <> : {d.campo === 'preco' ? fmtBRLFull(d.de) : fmtNum(d.de)} → {d.campo === 'preco' ? fmtBRLFull(d.para) : fmtNum(d.para)}</>}
                        {d.erro && <span style={{ color: C.red }}> ⚠ {d.erro}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA HISTÓRICO ── */}
      {aba === 'historico' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: C.muted }}>Últimas 50 execuções</span>
            <button onClick={carregarLog} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', border: `1px solid ${C.border}`, borderRadius: C.radius, background: C.surface, color: C.muted, fontSize: 12, cursor: 'pointer', ...font }}>
              <RefreshCw size={13} /> Atualizar
            </button>
          </div>

          {logCarregando ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Carregando…</div>
          ) : log.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.muted }}>Nenhuma execução registrada ainda.</div>
          ) : (
            <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusLg, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Data / hora</th>
                    <th style={th}>Modo</th>
                    <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    <th style={{ ...th, textAlign: 'right' }}>Preços</th>
                    <th style={{ ...th, textAlign: 'right' }}>Estoques</th>
                    <th style={{ ...th, textAlign: 'right' }}>Não enc.</th>
                    <th style={{ ...th, textAlign: 'right' }}>Erros</th>
                    <th style={{ ...th, textAlign: 'right' }}>Duração</th>
                    <th style={th}>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map(row => (
                    <React.Fragment key={row.id}>
                      <tr style={{ background: row.erros > 0 ? 'rgba(239,68,68,0.03)' : undefined }}>
                        <td style={td}>{fmtDt(row.executado_em)}</td>
                        <td style={td}>
                          <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: row.modo === 'real' ? C.amberBg : '#EEF2FF', color: row.modo === 'real' ? C.amber : C.blueDark }}>{row.modo}</span>
                        </td>
                        <td style={tdNum}>{row.total_bling}</td>
                        <td style={{ ...tdNum, color: row.preco_alterados > 0 ? C.green : C.txt }}>{row.preco_alterados}</td>
                        <td style={{ ...tdNum, color: row.estoque_alterados > 0 ? C.green : C.txt }}>{row.estoque_alterados}</td>
                        <td style={{ ...tdNum, color: row.nao_encontrados > 0 ? C.amber : C.txt }}>{row.nao_encontrados}</td>
                        <td style={{ ...tdNum, color: row.erros > 0 ? C.red : C.txt }}>{row.erros}</td>
                        <td style={tdNum}>{row.duracao_seg}s</td>
                        <td style={td}>
                          {row.detalhes?.length > 0 && (
                            <button onClick={() => setExpandido(expandido === row.id ? null : row.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: C.blueDark, cursor: 'pointer', fontSize: 12, fontWeight: 600, ...font }}>
                              {expandido === row.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              {row.detalhes.length} itens
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandido === row.id && (
                        <tr>
                          <td colSpan={9} style={{ padding: 0, background: '#F8FAFC' }}>
                            <div style={{ padding: '12px 16px', maxHeight: 280, overflowY: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr>
                                    <th style={{ ...th, fontSize: 10, background: '#E2E8F0', color: C.muted }}>SKU</th>
                                    <th style={{ ...th, fontSize: 10, background: '#E2E8F0', color: C.muted }}>Campo / Status</th>
                                    <th style={{ ...th, fontSize: 10, background: '#E2E8F0', color: C.muted, textAlign: 'right' }}>De</th>
                                    <th style={{ ...th, fontSize: 10, background: '#E2E8F0', color: C.muted, textAlign: 'right' }}>Para</th>
                                    <th style={{ ...th, fontSize: 10, background: '#E2E8F0', color: C.muted }}>Erro</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.detalhes.map((d: any, i: number) => (
                                    <tr key={i} style={{ background: d.erro ? C.redBg : undefined }}>
                                      <td style={{ ...td, fontSize: 12, fontWeight: 700, color: C.blueDark }}>{d.sku}</td>
                                      <td style={{ ...td, fontSize: 12 }}>{d.campo ?? d.status}</td>
                                      <td style={{ ...tdNum, fontSize: 12 }}>{d.de != null ? (d.campo === 'preco' ? fmtBRLFull(d.de) : fmtNum(d.de)) : '—'}</td>
                                      <td style={{ ...tdNum, fontSize: 12 }}>{d.para != null ? (d.campo === 'preco' ? fmtBRLFull(d.para) : fmtNum(d.para)) : '—'}</td>
                                      <td style={{ ...td, fontSize: 12, color: C.red }}>{d.erro ?? '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
