import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtBRL, fmtPct } from '../../lib/fmt'
import type { SubgroupAnalysis } from '../../types/campaigns'

const font = { fontFamily: 'DM Sans, sans-serif' }
const mono = { fontFamily: 'DM Mono, monospace' }
const th: React.CSSProperties = { textAlign: 'right', padding: '8px 10px', background: 'var(--blue-dark)', color: '#fff', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap', ...font }
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, ...font }
const tdM: React.CSSProperties = { ...td, textAlign: 'right', fontWeight: 600, ...mono }

interface Props { data: SubgroupAnalysis[] }

export default function SubgroupTable({ data }: Props) {
  if (!data.length) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, textAlign: 'center', color: 'var(--text-hint)', fontSize: 13, ...font }}>
        Vincule campanhas a subgrupos em <strong>Configurações</strong> para ver o cruzamento aqui.
      </div>
    )
  }

  const totalInvest = data.reduce((s, r) => s + r.investimento, 0)
  const totalFat = data.reduce((s, r) => s + r.faturamento, 0)
  const totalFatAnt = data.reduce((s, r) => s + r.faturamentoAnterior, 0)
  const totalDelta = totalFatAnt > 0 ? ((totalFat - totalFatAnt) / totalFatAnt) * 100 : 0
  const totalPct = totalFat > 0 ? (totalInvest / totalFat) * 100 : 0
  const totalRoas = totalInvest > 0 ? totalFat / totalInvest : 0

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Subgrupo</th>
            <th style={th}>Investido</th>
            <th style={th}>Faturamento</th>
            <th style={th}>vs Anterior</th>
            <th style={th}>% Invest/Fat</th>
            <th style={th}>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const pctOk = r.pctInvestFat >= 4 && r.pctInvestFat <= 7
            const roasOk = r.roas >= 3
            return (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#FAFBFC', borderBottom: '1px solid var(--border)' }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>
                  <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '1px 8px', borderRadius: 20, background: '#EFF6FF', color: 'var(--blue-dark)' }}>{r.subgrupo}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 8 }}>{r.campanhas} campanha(s)</span>
                </td>
                <td style={tdM}>{fmtBRL(r.investimento)}</td>
                <td style={{ ...tdM, fontSize: 15, color: 'var(--blue-dark)' }}>{fmtBRL(r.faturamento)}</td>
                <td style={{ ...td, textAlign: 'right' }}><DeltaBadge value={r.deltaPerc} /></td>
                <td style={{ ...tdM, color: r.pctInvestFat === 0 ? 'var(--text-hint)' : pctOk ? 'var(--green)' : 'var(--amber)' }}>{r.pctInvestFat > 0 ? fmtPct(r.pctInvestFat, 1) : '–'}</td>
                <td style={{ ...tdM, color: r.roas === 0 ? 'var(--text-hint)' : roasOk ? 'var(--green)' : 'var(--red)' }}>{r.roas > 0 ? `${r.roas.toFixed(1)}x` : '–'}</td>
              </tr>
            )
          })}
          <tr style={{ background: '#EFF6FF', borderTop: '2px solid var(--border)' }}>
            <td style={{ ...td, fontWeight: 700, color: 'var(--blue-dark)' }}>Total</td>
            <td style={{ ...tdM, fontWeight: 700 }}>{fmtBRL(totalInvest)}</td>
            <td style={{ ...tdM, fontWeight: 700, fontSize: 15, color: 'var(--blue-dark)' }}>{fmtBRL(totalFat)}</td>
            <td style={{ ...td, textAlign: 'right' }}><DeltaBadge value={totalDelta} /></td>
            <td style={{ ...tdM, fontWeight: 700 }}>{totalFat > 0 ? fmtPct(totalPct, 1) : '–'}</td>
            <td style={{ ...tdM, fontWeight: 700, color: 'var(--green)' }}>{totalInvest > 0 ? `${totalRoas.toFixed(1)}x` : '–'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span style={{ fontSize: 11, color: 'var(--text-hint)' }}>–</span>
  const isUp = value > 0
  const color = isUp ? 'var(--green)' : 'var(--red)'
  const Icon = isUp ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color }}>
      <Icon size={12} />
      {isUp ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}
