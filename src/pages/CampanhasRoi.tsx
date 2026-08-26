import React, { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useCampanhaRoi } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, AlertBanner } from '../components/ui'
import { PageHeader, KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum } from '../lib/fmt'

type SortKey = 'investimento' | 'faturamento' | 'roas' | 'leadsNossos' | 'compraram'

// Nome curto: tira as tags [F3][data] etc, mantém o essencial pra leitura na tabela.
function shortCampanha(nome: string): string {
  const s = nome.replace(/\[[^\]]*\]\s*/g, '').trim()
  return s || nome
}

export default function CampanhasRoi() {
  const { data, loading, error } = useCampanhaRoi()
  const [sortKey, setSortKey] = useState<SortKey>('investimento')

  const rows = useMemo(() => [...(data || [])].sort((a, b) => b[sortKey] - a[sortKey]), [data, sortKey])

  const totais = useMemo(() => {
    const investimento = (data||[]).reduce((s,c)=>s+c.investimento,0)
    const faturamento  = (data||[]).reduce((s,c)=>s+c.faturamento,0)
    const leadsNossos  = (data||[]).reduce((s,c)=>s+c.leadsNossos,0)
    const compraram    = (data||[]).reduce((s,c)=>s+c.compraram,0)
    return {
      investimento, faturamento, leadsNossos, compraram,
      roas: investimento>0 ? faturamento/investimento : 0,
      cpl: leadsNossos>0 ? investimento/leadsNossos : 0,
    }
  }, [data])

  const th = (key: SortKey | null, label: string, alignLeft = false): React.CSSProperties => ({
    textAlign: alignLeft ? 'left' : 'right',
    padding: '7px 10px', fontSize: 11, color: sortKey===key ? 'var(--blue-dark)' : 'var(--text-hint)',
    fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
    whiteSpace: 'nowrap', cursor: key ? 'pointer' : 'default', userSelect: 'none',
  })
  const td: React.CSSProperties = { padding: '9px 10px', textAlign: 'right', fontFamily: 'DM Mono, monospace', fontSize: 12.5 }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      <PageHeader title="Campanhas — ROI real">
        <span style={{ fontSize: 12, color: 'var(--text-hint)' }}>Últimos 60 dias · investimento, leads e vendas de verdade por campanha</span>
      </PageHeader>

      {error && (
        <div style={{ marginBottom: 14 }}>
          <AlertBanner type="error">Erro ao carregar ROI de campanhas: {error}</AlertBanner>
        </div>
      )}

      {loading ? <Spinner /> : (data||[]).length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: 13 }}>
          <TrendingUp size={26} color="var(--text-hint)" style={{ marginBottom: 8 }} /><br />
          Nenhuma campanha nos últimos 60 dias.
        </div>
      ) : (
        <>
          <KpiGrid cols={5}>
            <KpiCard label="Investimento total" value={fmtBRL(totais.investimento)} />
            <KpiCard label="Leads" value={fmtNum(totais.leadsNossos)} />
            <KpiCard label="CPL médio" value={totais.leadsNossos>0?fmtBRL(totais.cpl):'–'} />
            <KpiCard label="Faturamento" value={fmtBRL(totais.faturamento)} highlight />
            <KpiCard label="ROAS" value={totais.roas.toFixed(1)+'x'}
              trend={totais.roas>=3?'up':totais.roas>0?'neutral':'down'} />
          </KpiGrid>

          <Card>
            <CardTitle>Por campanha <span style={{fontSize:11,fontWeight:400,color:'var(--text-hint)'}}>— clique no cabeçalho para ordenar</span></CardTitle>
            <div className="ecom-scroll-x">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 920 }}>
                <thead>
                  <tr>
                    <th style={th(null, 'Campanha', true)}>Campanha</th>
                    <th style={th('investimento', 'Investimento')} onClick={() => setSortKey('investimento')}>Investimento</th>
                    <th style={th(null, 'Cliques')}>Cliques</th>
                    <th style={th(null, 'Leads Meta')}>Leads Meta</th>
                    <th style={th('leadsNossos', 'Leads (nossos)')} onClick={() => setSortKey('leadsNossos')}>Leads (nossos)</th>
                    <th style={th('compraram', 'Compraram')} onClick={() => setSortKey('compraram')}>Compraram</th>
                    <th style={th(null, 'Conversão')}>Conversão</th>
                    <th style={th(null, 'CPL')}>CPL</th>
                    <th style={th('faturamento', 'Faturamento')} onClick={() => setSortKey('faturamento')}>Faturamento</th>
                    <th style={th('roas', 'ROAS')} onClick={() => setSortKey('roas')}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c, i) => {
                    const semAtribuicao = c.leadsNossos === 0 && c.investimento > 0
                    const convColor = c.taxaConvPct == null ? 'neutral' : c.taxaConvPct >= 2 ? 'ok' : c.taxaConvPct >= 0.5 ? 'warn' : 'err'
                    const roasColor = c.roas >= 3 ? 'ok' : c.roas > 0 ? 'warn' : 'err'
                    return (
                      <tr key={c.campanha} style={{ borderBottom: i < rows.length-1 ? '1px solid var(--border)' : 'none', background: semAtribuicao ? 'rgba(226,232,240,0.3)' : 'transparent' }}>
                        <td style={{ padding: '9px 10px', maxWidth: 320 }}>
                          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.campanha}>{shortCampanha(c.campanha)}</div>
                          {semAtribuicao && <div style={{ fontSize: 10.5, color: 'var(--text-hint)' }}>s/ atrib. (campanha antiga)</div>}
                        </td>
                        <td style={td}>{fmtBRL(c.investimento)}</td>
                        <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtNum(c.cliques)}</td>
                        <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtNum(c.leadsMeta)}</td>
                        <td style={td}>{fmtNum(c.leadsNossos)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{fmtNum(c.compraram)}</td>
                        <td style={td}>{c.taxaConvPct != null ? <Badge value={`${c.taxaConvPct.toFixed(1)}%`} type={convColor} /> : <span style={{color:'var(--text-hint)'}}>–</span>}</td>
                        <td style={{ ...td, color: 'var(--text-muted)' }}>{c.cpl != null ? fmtBRL(c.cpl) : '–'}</td>
                        <td style={{ ...td, fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtBRL(c.faturamento)}</td>
                        <td style={td}><Badge value={c.roas.toFixed(1)+'x'} type={roasColor} /></td>
                      </tr>
                    )
                  })}
                  <tr style={{ background: '#F8FAFC' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 700 }}>TOTAL ({rows.length} campanhas)</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtBRL(totais.investimento)}</td>
                    <td colSpan={2} />
                    <td style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.leadsNossos)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.compraram)}</td>
                    <td colSpan={2} />
                    <td style={{ ...td, fontWeight: 700, color: 'var(--blue-dark)' }}>{fmtBRL(totais.faturamento)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{totais.roas.toFixed(1)}x</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
