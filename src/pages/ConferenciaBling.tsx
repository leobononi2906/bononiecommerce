import React, { useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, Square, AlertTriangle, Check } from 'lucide-react'
import { fmtBRLFull, fmtNum } from '../lib/fmt'
import { supabase } from '../lib/supabase'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

const FUNC_URL =
  (import.meta.env.VITE_SUPABASE_URL ?? 'https://vishxwdxqiygbxmtpfoy.supabase.co') +
  '/functions/v1/bling-sync'

type Item = {
  sku: string; codigo: string; nome: string; id_bling: number; id_produto: number | null
  achou: boolean
  sincronizar: boolean
  precoManual: number | string | null
  estoqueManual: number | string | null
  precoErp: number | null; estErp: number | null
  precoBling: number | null; estBling: number | null
}
type Filtro = 'todos' | 'divergentes' | 'preco' | 'estoque' | 'nao' | 'manual'

const C = {
  blueDark: 'var(--blue-dark)', blueMid: 'var(--blue-mid)', surface: 'var(--surface)', border: 'var(--border)',
  txt: 'var(--text-primary)', muted: 'var(--text-muted)', hint: 'var(--text-hint)',
  green: 'var(--green)', greenBg: 'var(--green-bg)', red: 'var(--red)', redBg: 'var(--red-bg)',
  amber: 'var(--amber)', amberBg: 'var(--amber-bg)', radius: 'var(--radius)', radiusLg: 'var(--radius-lg)',
}
const font = { fontFamily: 'DM Sans, sans-serif' }
const numOrNull = (v: number | string | null) =>
  v === '' || v == null ? null : (isNaN(Number(v)) ? null : Number(v))

function envioDe(it: Item) {
  const preco = it.sincronizar ? it.precoErp : numOrNull(it.precoManual)
  const est = it.sincronizar ? it.estErp : numOrNull(it.estoqueManual)
  return { preco, est }
}
function mudaPreco(it: Item) { const { preco } = envioDe(it); return preco != null && Math.abs(preco - (it.precoBling ?? 0)) > 0.001 }
function mudaEstoque(it: Item) { const { est } = envioDe(it); return est != null && (it.estBling == null || Math.abs(est - it.estBling) > 0.001) }
function statusDe(it: Item) {
  if (!it.achou) return { bg: '#EEF0F4', fg: C.hint, txt: 'Sem par' }
  if (!it.sincronizar) return { bg: '#EEF2FF', fg: C.blueDark, txt: 'Manual' }
  const p = mudaPreco(it), e = mudaEstoque(it)
  if (p && e) return { bg: C.redBg, fg: C.red, txt: 'Preço+Estoque' }
  if (p) return { bg: C.amberBg, fg: C.amber, txt: 'Preço difere' }
  if (e) return { bg: C.amberBg, fg: C.amber, txt: 'Estoque difere' }
  return { bg: C.greenBg, fg: C.green, txt: 'OK' }
}

export default function ConferenciaBling() {
  const [dados, setDados] = useState<Item[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [paginas, setPaginas] = useState(0)
  const [salvo, setSalvo] = useState<number | null>(null)
  const pararRef = useRef(false)

  const resumo = useMemo(() => ({
    total: dados.length,
    ok: dados.filter(d => d.achou && d.sincronizar && !mudaPreco(d) && !mudaEstoque(d)).length,
    preco: dados.filter(d => d.achou && mudaPreco(d)).length,
    estoque: dados.filter(d => d.achou && mudaEstoque(d)).length,
    manual: dados.filter(d => d.achou && !d.sincronizar).length,
    nao: dados.filter(d => !d.achou).length,
  }), [dados])

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return dados.filter(it => {
      if (filtro === 'divergentes' && !(mudaPreco(it) || mudaEstoque(it) || !it.achou)) return false
      if (filtro === 'preco' && !mudaPreco(it)) return false
      if (filtro === 'estoque' && !mudaEstoque(it)) return false
      if (filtro === 'nao' && it.achou) return false
      if (filtro === 'manual' && (it.sincronizar || !it.achou)) return false
      if (q && !((it.sku || '').toLowerCase().includes(q) || (it.nome || '').toLowerCase().includes(q))) return false
      return true
    })
  }, [dados, filtro, busca])

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

  async function salvar(it: Item) {
    if (it.id_produto == null) return
    try {
      const { error } = await supabase.from('bling_sync_overrides').upsert({
        id_produto: it.id_produto,
        sincronizar: it.sincronizar,
        preco_manual: it.sincronizar ? null : numOrNull(it.precoManual),
        estoque_manual: it.sincronizar ? null : numOrNull(it.estoqueManual),
        atualizado_em: new Date().toISOString(),
      }, { onConflict: 'id_produto' })
      if (error) throw error
      setSalvo(it.id_produto); setTimeout(() => setSalvo(s => (s === it.id_produto ? null : s)), 1200)
    } catch (e: any) { setErro(`Falha ao salvar ${it.sku}: ${e?.message ?? e}`) }
  }

  function patch(id_bling: number, campos: Partial<Item>, persistir = false) {
    setDados(ds => {
      const novo = ds.map(d => d.id_bling === id_bling ? { ...d, ...campos } : d)
      if (persistir) { const it = novo.find(d => d.id_bling === id_bling); if (it) salvar(it) }
      return novo
    })
  }

  const card = (n: string | number, label: string, fg: string) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '14px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: fg, ...font }}>{n}</div>
      <div style={{ fontSize: 11, color: C.muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.4px', fontWeight: 600, ...font }}>{label}</div>
    </div>
  )
  const segBtn = (f: Filtro, label: string) => (
    <button onClick={() => setFiltro(f)} style={{
      padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
      background: filtro === f ? C.surface : 'transparent', color: filtro === f ? C.blueDark : C.muted,
      boxShadow: filtro === f ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', ...font,
    }}>{label}</button>
  )

  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', background: C.blueDark, color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', position: 'sticky', top: 0, whiteSpace: 'nowrap', ...font }
  const td: React.CSSProperties = { padding: '8px 12px', borderBottom: `1px solid ${C.border}`, fontSize: 13, whiteSpace: 'nowrap', ...font }
  const tdNum: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
  const inp: React.CSSProperties = { width: 92, border: `1px solid ${C.border}`, borderRadius: 7, padding: '4px 7px', fontSize: 12.5, textAlign: 'right', ...font }

  return (
    <div style={{ padding: 24, ...font }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.blueDark }}>Conferência & Controle — Bling × ERP</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>
            Por padrão sincroniza preço (MLB PR) e estoque consolidado. Desmarque "Sincronizar" para congelar e digitar valores manuais.
          </div>
        </div>
        <button onClick={carregando ? () => { pararRef.current = true } : carregar} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: C.radius, border: 'none',
          background: carregando ? C.amber : C.blueMid, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', ...font,
        }}>
          {carregando ? <><Square size={14} /> Parar (pág. {paginas})</> : <><RefreshCw size={14} /> Carregar / Atualizar</>}
        </button>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.redBg, color: C.red, border: '1px solid #F5C2C2', borderRadius: C.radius, padding: '11px 14px', marginBottom: 14, fontSize: 13 }}>
          <AlertTriangle size={15} /> {erro}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        {card(fmtNum(resumo.total), 'Produtos lidos', C.blueMid)}
        {card(fmtNum(resumo.ok), 'Iguais (OK)', C.green)}
        {card(fmtNum(resumo.preco), 'Preço difere', C.amber)}
        {card(fmtNum(resumo.estoque), 'Estoque difere', C.amber)}
        {card(fmtNum(resumo.manual), 'Manuais', C.blueDark)}
        {card(fmtNum(resumo.nao), 'Sem par no ERP', C.red)}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', background: '#F1F5F9', border: `1px solid ${C.border}`, borderRadius: C.radius, padding: 3, gap: 2 }}>
          {segBtn('todos', 'Todos')}{segBtn('divergentes', 'Divergentes')}{segBtn('preco', 'Preço')}{segBtn('estoque', 'Estoque')}{segBtn('manual', 'Manuais')}{segBtn('nao', 'Sem par')}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.hint }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por SKU ou nome…"
            style={{ width: '100%', border: `1px solid ${C.border}`, borderRadius: C.radius, padding: '9px 12px 9px 32px', fontSize: 13, background: C.surface, ...font }} />
        </div>
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: C.radiusLg, overflow: 'hidden', background: C.surface }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'center' }}>Sinc.</th>
              <th style={th}>SKU</th>
              <th style={th}>Produto</th>
              <th style={{ ...th, textAlign: 'right' }}>Preço (ERP / manual)</th>
              <th style={{ ...th, textAlign: 'right' }}>Preço Bling</th>
              <th style={{ ...th, textAlign: 'right' }}>Estoque (ERP / manual)</th>
              <th style={{ ...th, textAlign: 'right' }}>Est. Bling</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: C.muted, padding: 40 }}>
                {carregando ? 'Carregando…' : dados.length ? 'Nada com esse filtro.' : 'Clique em "Carregar / Atualizar".'}
              </td></tr>
            ) : lista.map((it) => {
              const st = statusDe(it)
              return (
                <tr key={it.id_bling}>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <input type="checkbox" disabled={!it.achou} checked={it.sincronizar}
                      onChange={e => patch(it.id_bling, { sincronizar: e.target.checked }, true)}
                      style={{ width: 16, height: 16, cursor: it.achou ? 'pointer' : 'default', accentColor: '#1A3A8F' }} />
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: C.blueDark }}>
                    {it.sku || '—'}{salvo === it.id_produto && <Check size={13} color={'var(--green)'} style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                  </td>
                  <td style={{ ...td, whiteSpace: 'normal', maxWidth: 280 }}>{it.nome || ''}</td>

                  <td style={tdNum}>
                    {it.sincronizar
                      ? (it.precoErp == null ? '—' : fmtBRLFull(it.precoErp))
                      : <input type="number" step="0.01" value={it.precoManual ?? ''} placeholder="manual"
                          onChange={e => patch(it.id_bling, { precoManual: e.target.value })}
                          onBlur={() => patch(it.id_bling, {}, true)} style={inp} />}
                  </td>
                  <td style={{ ...tdNum, color: mudaPreco(it) ? C.amber : C.txt }}>{it.precoBling == null ? '—' : fmtBRLFull(it.precoBling)}</td>

                  <td style={tdNum}>
                    {it.sincronizar
                      ? (it.estErp == null ? '—' : fmtNum(it.estErp))
                      : <input type="number" step="1" value={it.estoqueManual ?? ''} placeholder="manual"
                          onChange={e => patch(it.id_bling, { estoqueManual: e.target.value })}
                          onBlur={() => patch(it.id_bling, {}, true)} style={inp} />}
                  </td>
                  <td style={{ ...tdNum, color: mudaEstoque(it) ? C.amber : C.txt }}>{it.estBling == null ? '—' : fmtNum(it.estBling)}</td>

                  <td style={td}><span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.fg }}>{st.txt}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
