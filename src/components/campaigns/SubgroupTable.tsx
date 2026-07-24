import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtBRL, fmtPct } from '../../lib/fmt'
import type { SubgroupAnalysis } from '../../types/campaigns'

interface Props {
  data: SubgroupAnalysis[]
}

export default function SubgroupTable({ data }: Props) {
  if (!data.length) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-center text-txt-hint text-sm">
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
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <table className="w-full" style={{ borderCollapse: 'collapse', fontFamily: 'DM Sans' }}>
        <thead>
          <tr className="bg-blue-dark text-white">
            {['Subgrupo', 'Investido', 'Faturamento', 'vs Anterior', '% Invest/Fat', 'ROAS'].map((h, i) => (
              <th key={i} className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                style={{ textAlign: i === 0 ? 'left' : 'right' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((r, i) => {
            const pctOk = r.pctInvestFat >= 4 && r.pctInvestFat <= 7
            const roasOk = r.roas >= 3
            return (
              <tr key={i} className="border-b border-border" style={{ background: i % 2 === 0 ? 'transparent' : '#FAFBFC' }}>
                <td className="px-3 py-2.5 text-[13px] font-semibold">
                  <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#EFF6FF', color: 'var(--blue-dark)' }}>{r.subgrupo}</span>
                  <span className="text-[11px] text-txt-hint ml-2">{r.campanhas} campanha(s)</span>
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold">{fmtBRL(r.investimento)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-[15px] font-semibold text-blue-dark">{fmtBRL(r.faturamento)}</td>
                <td className="px-3 py-2.5 text-right">
                  <DeltaBadge value={r.deltaPerc} />
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold"
                  style={{ color: r.pctInvestFat === 0 ? 'var(--text-hint)' : pctOk ? 'var(--green)' : 'var(--amber)' }}>
                  {r.pctInvestFat > 0 ? fmtPct(r.pctInvestFat, 1) : '–'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold"
                  style={{ color: r.roas === 0 ? 'var(--text-hint)' : roasOk ? 'var(--green)' : 'var(--red)' }}>
                  {r.roas > 0 ? `${r.roas.toFixed(1)}x` : '–'}
                </td>
              </tr>
            )
          })}
          {/* Total row */}
          <tr style={{ background: '#EFF6FF', borderTop: '2px solid var(--border)' }}>
            <td className="px-3 py-2.5 text-[13px] font-bold text-blue-dark">Total</td>
            <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold">{fmtBRL(totalInvest)}</td>
            <td className="px-3 py-2.5 text-right font-mono text-[15px] font-bold text-blue-dark">{fmtBRL(totalFat)}</td>
            <td className="px-3 py-2.5 text-right"><DeltaBadge value={totalDelta} /></td>
            <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold">{totalFat > 0 ? fmtPct(totalPct, 1) : '–'}</td>
            <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold" style={{ color: 'var(--green)' }}>
              {totalInvest > 0 ? `${totalRoas.toFixed(1)}x` : '–'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function DeltaBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-txt-hint text-[11px]">–</span>
  const isUp = value > 0
  const color = isUp ? 'var(--green)' : 'var(--red)'
  const Icon = isUp ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color }}>
      <Icon size={12} />
      {isUp ? '+' : ''}{value.toFixed(1)}%
    </span>
  )
}
