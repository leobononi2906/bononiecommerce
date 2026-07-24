import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from 'recharts'
import { fmtBRL } from '../../lib/fmt'
import type { CampaignAnalysis } from '../../types/campaigns'
import type { CampaignThresholds } from '../../lib/thresholds'

const SIGNAL_COLORS = { green: '#16A34A', yellow: '#D97706', red: '#DC2626' }

interface Props {
  campaigns: CampaignAnalysis[]
  thresholds: CampaignThresholds
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload as CampaignAnalysis
  return (
    <div className="bg-surface border border-border rounded-lg p-3 shadow-lg text-xs" style={{ fontFamily: 'DM Sans' }}>
      <div className="font-bold text-txt mb-1">{d.shortName}</div>
      <div className="text-txt-muted">Gasto: <span className="font-mono font-semibold">{fmtBRL(d.spend)}</span></div>
      <div className="text-txt-muted">ROAS: <span className="font-mono font-semibold">{d.roas.toFixed(1)}x</span></div>
      <div className="text-txt-muted">Leads: <span className="font-mono font-semibold">{d.leads}</span></div>
      <div className="mt-1 font-bold" style={{ color: SIGNAL_COLORS[d.signal] }}>{d.verdict}</div>
    </div>
  )
}

export default function CampaignScatterPlot({ campaigns, thresholds }: Props) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-sm font-semibold text-txt mb-1">ROAS vs Investimento</div>
      <div className="text-[11px] text-txt-hint mb-3">Cada ponto = 1 campanha · Cor = veredicto · Acima da linha verde = saudável</div>
      <ResponsiveContainer width="100%" height={280}>
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="spend" type="number" name="Investimento"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={v => fmtBRL(v)}
          />
          <YAxis
            dataKey="roas" type="number" name="ROAS"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={v => `${v}x`}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={thresholds.roas_green} stroke="#16A34A" strokeDasharray="6 3" strokeWidth={1.5} />
          <ReferenceLine y={thresholds.roas_yellow} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1} />
          <Scatter data={campaigns} fillOpacity={0.85}>
            {campaigns.map((c, i) => (
              <Cell key={i} fill={SIGNAL_COLORS[c.signal]} r={Math.max(5, Math.min(12, c.leads / 3))} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
