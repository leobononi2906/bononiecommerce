import React, { useMemo, useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import { useVendedoresDim, useRelatorioItens } from '../hooks/use-relatorios'
import type { Canal, VendedorDim } from '../hooks/use-relatorios'
import { PageHeader, KpiGrid } from '../components/layout'
import { KpiCard, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { fmtBRL, fmtNum } from '../lib/fmt'

const CANAIS: { v: Canal; label: string }[] = [
  { v: 'vendedor', label: 'Vendedores' },
  { v: 'site', label: 'Site' },
  { v: 'marketplace', label: 'Marketplace' },
]
const CANAL_LABEL: Record<Canal, string> = { vendedor: 'Vendedores', site: 'Site', marketplace: 'Marketplace' }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// número no padrão pt-BR para CSV (vírgula decimal, sem separador de milhar)
const csvNum = (v: number, dec = 2) => v.toFixed(dec).replace('.', ',')

const INPUT: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  fontSize: 13, fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)',
  background: 'var(--surface)', outline: 'none',
}

export default function Relatorios() {
  const now = new Date()
  const [start, setStart] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [end, setEnd] = useState(iso(now))
  const [canalSel, setCanalSel] = useState<Set<Canal>>(new Set(['vendedor', 'site', 'marketplace']))
  const [vendSel, setVendSel] = useState<Set<string>>(new Set())   // vazio = todos
  const [groupBy, setGroupBy] = useState<'produto' | 'vendedor'>('produto')

  const { data: dim, loading: ldim } = useVendedoresDim(start, end, true)
  const { data: itens, loading: litens } = useRelatorioItens(start, end, true)

  // id_vendedor → { nome, canal }
  const idDim = useMemo(() => {
    const m = new Map<number, VendedorDim>()
    ;(dim || []).forEach(d => m.set(d.id_vendedor, d))
    return m
  }, [dim])

  const nomeDe = (id: number) => idDim.get(id)?.nome || `#${id}`
  const canalDe = (id: number): Canal => idDim.get(id)?.canal ?? 'vendedor'

  // opções de vendedor: quem teve venda no período, dentro dos canais marcados
  const vendOptions = useMemo(() => {
    const m = new Map<string, Canal>()
    ;(itens || []).forEach(it => {
      const canal = canalDe(it.id_vendedor)
      if (!canalSel.has(canal)) return
      const nome = nomeDe(it.id_vendedor)
      if (!m.has(nome)) m.set(nome, canal)
    })
    return [...m.entries()].map(([nome, canal]) => ({ nome, canal })).sort((a, b) => a.nome.localeCompare(b.nome))
  }, [itens, idDim, canalSel])

  // itens após aplicar canal + vendedor
  const itensFiltrados = useMemo(() => {
    return (itens || []).filter(it => {
      if (!canalSel.has(canalDe(it.id_vendedor))) return false
      if (vendSel.size > 0 && !vendSel.has(nomeDe(it.id_vendedor))) return false
      return true
    })
  }, [itens, idDim, canalSel, vendSel])

  // agregação
  const linhas = useMemo(() => {
    type Agg = { chave: string; nome: string; extra: string; qtd: number; fat: number; docs: Set<number> }
    const map = new Map<string, Agg>()
    itensFiltrados.forEach(it => {
      let chave: string, nome: string, extra: string
      if (groupBy === 'produto') { chave = it.referencia; nome = it.produto; extra = it.referencia }
      else { nome = nomeDe(it.id_vendedor); chave = nome; extra = CANAL_LABEL[canalDe(it.id_vendedor)] }
      const a = map.get(chave) || { chave, nome, extra, qtd: 0, fat: 0, docs: new Set<number>() }
      a.qtd += it.qtd; a.fat += it.fat; a.docs.add(it.id_doc)
      if (groupBy === 'produto' && (!a.nome || a.nome === '—') && it.produto) a.nome = it.produto
      map.set(chave, a)
    })
    return [...map.values()]
      .map(a => ({ chave: a.chave, nome: a.nome, extra: a.extra, qtd: a.qtd, fat: a.fat, pedidos: a.docs.size, ticket: a.docs.size > 0 ? a.fat / a.docs.size : 0 }))
      .sort((x, y) => y.fat - x.fat)
  }, [itensFiltrados, groupBy, idDim])

  const totais = useMemo(() => {
    const fat = linhas.reduce((s, l) => s + l.fat, 0)
    const qtd = linhas.reduce((s, l) => s + l.qtd, 0)
    const docs = new Set<number>()
    itensFiltrados.forEach(it => docs.add(it.id_doc))
    return { fat, qtd, pedidos: docs.size, ticket: docs.size > 0 ? fat / docs.size : 0 }
  }, [linhas, itensFiltrados])

  function toggleCanal(c: Canal) {
    setCanalSel(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n })
    setVendSel(new Set()) // reset vendedor ao mudar canal
  }
  function toggleVend(nome: string) {
    setVendSel(prev => { const n = new Set(prev); n.has(nome) ? n.delete(nome) : n.add(nome); return n })
  }
  function preset(tipo: 'mes' | 'mespassado' | 'ano') {
    const y = now.getFullYear(), m = now.getMonth()
    if (tipo === 'mes') { setStart(iso(new Date(y, m, 1))); setEnd(iso(now)) }
    else if (tipo === 'mespassado') { setStart(iso(new Date(y, m - 1, 1))); setEnd(iso(new Date(y, m, 0))) }
    else { setStart(iso(new Date(y, 0, 1))); setEnd(iso(now)) }
  }

  function exportarCSV() {
    const head = groupBy === 'produto'
      ? ['Referência', 'Produto', 'Quantidade', 'Faturamento', 'Ticket médio', 'Pedidos']
      : ['Vendedor', 'Canal', 'Quantidade', 'Faturamento', 'Ticket médio', 'Pedidos']
    const linhasCsv = linhas.map(l => groupBy === 'produto'
      ? [l.extra, l.nome, csvNum(l.qtd, 0), csvNum(l.fat), csvNum(l.ticket), String(l.pedidos)]
      : [l.nome, l.extra, csvNum(l.qtd, 0), csvNum(l.fat), csvNum(l.ticket), String(l.pedidos)])
    const totalRow = groupBy === 'produto'
      ? ['', 'TOTAL', csvNum(totais.qtd, 0), csvNum(totais.fat), csvNum(totais.ticket), String(totais.pedidos)]
      : ['TOTAL', '', csvNum(totais.qtd, 0), csvNum(totais.fat), csvNum(totais.ticket), String(totais.pedidos)]
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
        {/* datas + presets */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Data início</label>
            <input type="date" style={INPUT} value={start} max={end} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Data fim</label>
            <input type="date" style={INPUT} value={end} min={start} onChange={e => setEnd(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['mes', 'Mês atual'], ['mespassado', 'Mês passado'], ['ano', 'Este ano']].map(([k, l]) => (
              <button key={k} onClick={() => preset(k as any)}
                style={{ padding: '7px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)', fontFamily: 'DM Sans, sans-serif' }}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,220px) 1fr', gap: 16 }}>
          {/* canais */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Canais</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {CANAIS.map(c => (
                <label key={c.v} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={canalSel.has(c.v)} onChange={() => toggleCanal(c.v)} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>
          {/* vendedores */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, textTransform: 'uppercase' }}>
                Vendedores {vendSel.size > 0 ? `(${vendSel.size} selecionados)` : '(todos)'}
              </label>
              {vendSel.size > 0 && <button onClick={() => setVendSel(new Set())} style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--blue-mid)', cursor: 'pointer', fontWeight: 600 }}>Todos</button>}
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', maxHeight: 150, overflowY: 'auto', padding: '8px 10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 4 }}>
              {ldim || litens ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Carregando…</span>
                : vendOptions.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>{canalSel.size === 0 ? 'Marque ao menos um canal.' : 'Sem vendas no período/canais selecionados.'}</span>
                : vendOptions.map(v => (
                  <label key={v.nome} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', minWidth: 0 }}>
                    <input type="checkbox" checked={vendSel.has(v.nome)} onChange={() => toggleVend(v.nome)} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.nome}>{v.nome}</span>
                  </label>
                ))}
            </div>
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
          {([['produto', 'Por produto'], ['vendedor', 'Por vendedor']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setGroupBy(v)}
              style={{ padding: '6px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: groupBy === v ? 'var(--surface)' : 'transparent', color: groupBy === v ? 'var(--blue-dark)' : 'var(--text-muted)', boxShadow: groupBy === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', fontFamily: 'DM Sans, sans-serif' }}>{l}</button>
          ))}
        </div>
        <button onClick={exportarCSV} disabled={litens || linhas.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: litens || linhas.length === 0 ? 'not-allowed' : 'pointer', opacity: litens || linhas.length === 0 ? 0.5 : 1, fontFamily: 'DM Sans, sans-serif' }}>
          <FileSpreadsheet size={15} /> Exportar CSV (Excel)
        </button>
      </div>

      {/* ── TABELA ── */}
      <Card>
        <CardTitle>{groupBy === 'produto' ? 'Agrupado por produto' : 'Agrupado por vendedor'} — {linhas.length} {groupBy === 'produto' ? 'produtos' : 'vendedores'}</CardTitle>
        {litens ? <Spinner /> : linhas.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 32, fontSize: 13 }}>
            Nenhum registro para os filtros selecionados.
          </div>
        ) : (
          <div className="ecom-scroll-x">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
              <thead><tr>
                <th style={thL}>{groupBy === 'produto' ? 'Produto' : 'Vendedor'}</th>
                <th style={th}>Qtd</th>
                <th style={th}>Faturamento</th>
                <th style={th}>Ticket médio</th>
                <th style={th}>Pedidos</th>
              </tr></thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={l.chave} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px', maxWidth: 320 }}>
                      <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={l.nome}>{l.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-hint)', fontFamily: groupBy === 'produto' ? 'DM Mono, monospace' : 'DM Sans, sans-serif' }}>{l.extra}</div>
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
