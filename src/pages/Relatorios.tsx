import React, { useMemo, useState } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useVendedoresDim, useRelatorioItens } from '../hooks/use-relatorios'
import type { Canal, VendedorDim } from '../hooks/use-relatorios'
import { PageHeader, KpiGrid } from '../components/layout'
import { KpiCard, Spinner, Card, CardTitle } from '../components/ui'
import { fmtBRL, fmtNum } from '../lib/fmt'

type GroupBy = 'produto' | 'vendedor' | 'mes'

const CANAIS: { v: Canal; label: string }[] = [
  { v: 'vendedor', label: 'Vendedores' },
  { v: 'site', label: 'Site' },
  { v: 'marketplace', label: 'Marketplace' },
]
const CANAL_LABEL: Record<Canal, string> = { vendedor: 'Vendedores', site: 'Site', marketplace: 'Marketplace' }
const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const csvNum = (v: number, dec = 2) => v.toFixed(dec).replace('.', ',')
function mesLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`
}

const INPUT: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)',
  background: 'var(--surface)', outline: 'none',
}
const LABEL: React.CSSProperties = { fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }
const BOX: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 132, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }

// caixa multi-seleção genérica (checkbox list)
function MultiBox({ options, sel, onToggle, vazio }: { options: string[]; sel: Set<string>; onToggle: (v: string) => void; vazio: string }) {
  if (options.length === 0) return <div style={BOX}><span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{vazio}</span></div>
  return (
    <div style={BOX}>
      {options.map(o => (
        <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', minWidth: 0 }}>
          <input type="checkbox" checked={sel.has(o)} onChange={() => onToggle(o)} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={o}>{o}</span>
        </label>
      ))}
    </div>
  )
}

export default function Relatorios() {
  const now = new Date()
  const [start, setStart] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [end, setEnd] = useState(iso(now))
  const [canalSel, setCanalSel] = useState<Set<Canal>>(new Set(['vendedor', 'site', 'marketplace']))
  const [vendSel, setVendSel] = useState<Set<string>>(new Set())     // vazio = todos
  const [grupoSel, setGrupoSel] = useState<Set<string>>(new Set())
  const [subgrupoSel, setSubgrupoSel] = useState<Set<string>>(new Set())
  const [produtoBusca, setProdutoBusca] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('produto')

  // Dimensão de vendedores: janela ampla (últimos 6 meses ∪ período) → inclui quem já saiu
  const seisMesesAtras = iso(new Date(now.getFullYear(), now.getMonth() - 5, 1))
  const dimStart = start < seisMesesAtras ? start : seisMesesAtras
  const dimEnd = end > iso(now) ? end : iso(now)
  const { data: dim, loading: ldim } = useVendedoresDim(dimStart, dimEnd, true)
  const { data: itens, loading: litens } = useRelatorioItens(start, end, true)

  const idDim = useMemo(() => {
    const m = new Map<number, VendedorDim>()
    ;(dim || []).forEach(d => m.set(d.id_vendedor, d))
    return m
  }, [dim])
  const nomeDe = (id: number) => idDim.get(id)?.nome || `#${id}`
  const canalDe = (id: number): Canal => idDim.get(id)?.canal ?? 'vendedor'

  // Opções de vendedor: TODOS os cadastrados na janela (inclui quem já saiu), filtrados pelo canal
  const vendOptions = useMemo(() => {
    return (dim || [])
      .filter(d => d.nome && canalSel.has(d.canal))
      .map(d => d.nome)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b))
  }, [dim, canalSel])

  // Itens após canal + vendedor (base para as opções de grupo/subgrupo)
  const itensCanalVend = useMemo(() => (itens || []).filter(it => {
    if (!canalSel.has(canalDe(it.id_vendedor))) return false
    if (vendSel.size > 0 && !vendSel.has(nomeDe(it.id_vendedor))) return false
    return true
  }), [itens, idDim, canalSel, vendSel])

  const grupoOptions = useMemo(
    () => [...new Set(itensCanalVend.map(it => it.grupo).filter(g => g && g !== '—'))].sort(),
    [itensCanalVend])
  const subgrupoOptions = useMemo(
    () => [...new Set(itensCanalVend.filter(it => grupoSel.size === 0 || grupoSel.has(it.grupo)).map(it => it.subgrupo).filter(s => s && s !== '—'))].sort(),
    [itensCanalVend, grupoSel])

  // Itens finais (aplica grupo + subgrupo + busca de produto)
  const itensFiltrados = useMemo(() => {
    const q = produtoBusca.trim().toLowerCase()
    return itensCanalVend.filter(it => {
      if (grupoSel.size > 0 && !grupoSel.has(it.grupo)) return false
      if (subgrupoSel.size > 0 && !subgrupoSel.has(it.subgrupo)) return false
      if (q && !(`${it.produto} ${it.referencia}`.toLowerCase().includes(q))) return false
      return true
    })
  }, [itensCanalVend, grupoSel, subgrupoSel, produtoBusca])

  // Agregação
  const linhas = useMemo(() => {
    type Agg = { chave: string; nome: string; extra: string; qtd: number; fat: number; docs: Set<number> }
    const map = new Map<string, Agg>()
    itensFiltrados.forEach(it => {
      let chave: string, nome: string, extra: string
      if (groupBy === 'produto') { chave = it.referencia; nome = it.produto; extra = it.referencia }
      else if (groupBy === 'vendedor') { nome = nomeDe(it.id_vendedor); chave = nome; extra = CANAL_LABEL[canalDe(it.id_vendedor)] }
      else { chave = it.mes; nome = mesLabel(it.mes); extra = '' }
      const a = map.get(chave) || { chave, nome, extra, qtd: 0, fat: 0, docs: new Set<number>() }
      a.qtd += it.qtd; a.fat += it.fat; a.docs.add(it.id_doc)
      if (groupBy === 'produto' && (!a.nome || a.nome === '—') && it.produto) a.nome = it.produto
      map.set(chave, a)
    })
    const arr = [...map.values()].map(a => ({ chave: a.chave, nome: a.nome, extra: a.extra, qtd: a.qtd, fat: a.fat, pedidos: a.docs.size, ticket: a.docs.size > 0 ? a.fat / a.docs.size : 0 }))
    return groupBy === 'mes' ? arr.sort((x, y) => x.chave < y.chave ? -1 : 1) : arr.sort((x, y) => y.fat - x.fat)
  }, [itensFiltrados, groupBy, idDim])

  const totais = useMemo(() => {
    const fat = linhas.reduce((s, l) => s + l.fat, 0)
    const qtd = linhas.reduce((s, l) => s + l.qtd, 0)
    const docs = new Set<number>()
    itensFiltrados.forEach(it => docs.add(it.id_doc))
    return { fat, qtd, pedidos: docs.size, ticket: docs.size > 0 ? fat / docs.size : 0 }
  }, [linhas, itensFiltrados])

  // Série mensal (para o gráfico do agrupamento "Por mês")
  const serieMensal = useMemo(() => {
    const m = new Map<string, number>()
    itensFiltrados.forEach(it => m.set(it.mes, (m.get(it.mes) || 0) + it.fat))
    return [...m.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([mes, fat]) => ({ mes: mesLabel(mes), fat }))
  }, [itensFiltrados])

  function toggleSet<T>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) {
    setter(prev => { const n = new Set(prev); n.has(v) ? n.delete(v) : n.add(v); return n })
  }
  function toggleCanal(c: Canal) { toggleSet(setCanalSel, c); setVendSel(new Set()) }
  function preset(tipo: 'mes' | 'mespassado' | 'ano') {
    const y = now.getFullYear(), m = now.getMonth()
    if (tipo === 'mes') { setStart(iso(new Date(y, m, 1))); setEnd(iso(now)) }
    else if (tipo === 'mespassado') { setStart(iso(new Date(y, m - 1, 1))); setEnd(iso(new Date(y, m, 0))) }
    else { setStart(iso(new Date(y, 0, 1))); setEnd(iso(now)) }
  }

  const colNome = groupBy === 'produto' ? 'Produto' : groupBy === 'vendedor' ? 'Vendedor' : 'Mês'
  const rotulo = groupBy === 'produto' ? 'produtos' : groupBy === 'vendedor' ? 'vendedores' : 'meses'

  function exportarCSV() {
    const head = [colNome, groupBy === 'produto' ? 'Nome' : groupBy === 'vendedor' ? 'Canal' : '', 'Quantidade', 'Faturamento', 'Ticket médio', 'Pedidos'].filter(Boolean)
    const rowOf = (chave: string, nome: string, extra: string, qtd: number, fat: number, ticket: number, ped: number) => {
      const base = groupBy === 'produto' ? [extra, nome] : groupBy === 'vendedor' ? [nome, extra] : [nome]
      return [...base, csvNum(qtd, 0), csvNum(fat), csvNum(ticket), String(ped)]
    }
    const linhasCsv = linhas.map(l => rowOf(l.chave, l.nome, l.extra, l.qtd, l.fat, l.ticket, l.pedidos))
    const totalRow = rowOf('', groupBy === 'produto' ? 'TOTAL' : groupBy === 'vendedor' ? 'TOTAL' : 'TOTAL', groupBy === 'produto' ? '' : '', totais.qtd, totais.fat, totais.ticket, totais.pedidos)
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`
    const body = [head, ...linhasCsv, totalRow].map(r => r.map(esc).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_${groupBy}_${start}_a_${end}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const th: React.CSSProperties = { textAlign: 'right', padding: '7px 10px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase', whiteSpace: 'nowrap' }
  const thL: React.CSSProperties = { ...th, textAlign: 'left' }
  const td: React.CSSProperties = { padding: '8px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace' }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      <PageHeader title="Relatórios" />

      {/* ── FILTROS ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <label style={LABEL}>Data início</label>
            <input type="date" style={INPUT} value={start} max={end} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label style={LABEL}>Data fim</label>
            <input type="date" style={INPUT} value={end} min={start} onChange={e => setEnd(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['mes', 'Mês atual'], ['mespassado', 'Mês passado'], ['ano', 'Este ano']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k as any)}
                style={{ padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{l}</button>
            ))}
          </div>
        </div>

        {/* linha 1: canais + vendedores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px,200px) 1fr', gap: 16, marginBottom: 14 }}>
          <div>
            <label style={LABEL}>Canais</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CANAIS.map(c => (
                <label key={c.v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={canalSel.has(c.v)} onChange={() => toggleCanal(c.v)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...LABEL, marginBottom: 0 }}>Vendedores {vendSel.size > 0 ? `(${vendSel.size} sel.)` : '(todos)'} <span style={{ textTransform: 'none', fontWeight: 400 }}>— últimos 6 meses, inclui quem saiu</span></label>
              {vendSel.size > 0 && <button onClick={() => setVendSel(new Set())} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--blue-mid)', cursor: 'pointer', fontWeight: 600 }}>Todos</button>}
            </div>
            <div style={{ ...BOX, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))' }}>
              {ldim ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Carregando…</span>
                : vendOptions.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{canalSel.size === 0 ? 'Marque ao menos um canal.' : 'Nenhum vendedor.'}</span>
                : vendOptions.map(nome => (
                  <label key={nome} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', minWidth: 0 }}>
                    <input type="checkbox" checked={vendSel.has(nome)} onChange={() => toggleSet(setVendSel, nome)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nome}>{nome}</span>
                  </label>
                ))}
            </div>
          </div>
        </div>

        {/* linha 2: grupo + subgrupo + produto */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={LABEL}>Grupo {grupoSel.size > 0 && `(${grupoSel.size})`}</label>
            <MultiBox options={grupoOptions} sel={grupoSel} onToggle={v => { toggleSet(setGrupoSel, v); setSubgrupoSel(new Set()) }} vazio="—" />
          </div>
          <div>
            <label style={LABEL}>Subgrupo {subgrupoSel.size > 0 && `(${subgrupoSel.size})`}</label>
            <MultiBox options={subgrupoOptions} sel={subgrupoSel} onToggle={v => toggleSet(setSubgrupoSel, v)} vazio="—" />
          </div>
          <div>
            <label style={LABEL}>Produto (busca)</label>
            <input style={{ ...INPUT, width: '100%' }} placeholder="Nome ou referência…" value={produtoBusca} onChange={e => setProdutoBusca(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* ── KPIs ── */}
      <KpiGrid cols={4}>
        <KpiCard label="Faturamento" value={litens ? '…' : fmtBRL(totais.fat)} highlight />
        <KpiCard label="Quantidade" value={litens ? '…' : fmtNum(totais.qtd)} />
        <KpiCard label="Pedidos" value={litens ? '…' : fmtNum(totais.pedidos)} />
        <KpiCard label="Ticket médio" value={litens ? '…' : fmtBRL(totais.ticket)} />
      </KpiGrid>

      {/* ── AGRUPAMENTO + EXPORT ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', padding: 3, borderRadius: 8 }}>
          {([['produto', 'Por produto'], ['vendedor', 'Por vendedor'], ['mes', 'Por mês']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setGroupBy(v)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: groupBy === v ? 'var(--surface)' : 'transparent', color: groupBy === v ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: groupBy === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'DM Sans, sans-serif' }}>{l}</button>
          ))}
        </div>
        <button onClick={exportarCSV} disabled={litens || linhas.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: litens || linhas.length === 0 ? 'not-allowed' : 'pointer', opacity: litens || linhas.length === 0 ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif' }}>
          <FileSpreadsheet size={15} /> Exportar CSV (Excel)
        </button>
      </div>

      {/* gráfico mensal (só no agrupamento Por mês) */}
      {groupBy === 'mes' && !litens && serieMensal.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <CardTitle>Faturamento por mês</CardTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serieMensal} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={70} />
              <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="fat" name="Faturamento" fill="var(--blue-mid)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── TABELA ── */}
      <Card>
        <CardTitle>Agrupado por {colNome.toLowerCase()} — {linhas.length} {rotulo}</CardTitle>
        {litens ? <Spinner /> : linhas.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
            Nenhum registro para os filtros selecionados.
          </div>
        ) : (
          <div className="ecom-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead><tr>
                <th style={thL}>{colNome}</th>
                <th style={th}>Qtd</th>
                <th style={th}>Faturamento</th>
                <th style={th}>Ticket médio</th>
                <th style={th}>Pedidos</th>
              </tr></thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.chave} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', maxWidth: 320 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.nome}>{l.nome}</div>
                      {l.extra && <div style={{ fontSize: 11, color: 'var(--text-hint)', fontFamily: groupBy === 'produto' ? 'DM Mono, monospace' : 'DM Sans, sans-serif' }}>{l.extra}</div>}
                    </td>
                    <td style={td}>{fmtNum(l.qtd)}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtBRL(l.fat)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtBRL(l.ticket)}</td>
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtNum(l.pedidos)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#F8FAFC' }}>
                  <td style={{ padding: '8px 10px', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.qtd)}</td>
                  <td style={{ ...td, fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtBRL(totais.fat)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmtBRL(totais.ticket)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.pedidos)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
