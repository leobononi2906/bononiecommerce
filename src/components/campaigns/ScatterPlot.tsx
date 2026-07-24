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
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12, fontFamily: 'DM Sans' }}>
      <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>{d.shortName}</div>
      <div style={{ color: 'var(--text-muted)' }}>Gasto: <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{fmtBRL(d.spend)}</span></div>
      <div style={{ color: 'var(--text-muted)' }}>ROAS: <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{d.roas.toFixed(1)}x</span></div>
      <div style={{ color: 'var(--text-muted)' }}>Vendas: <span style={{ fontFamily: 'DM Mono', fontWeight: 600 }}>{d.vendas}</span></div>
      <div style={{ marginTop: 4, fontWeight: 700, color: SIGNAL_COLORS[d.signal] }}>{d.verdict}</div>
    </div>
  )
}

export default function CampaignScatterPlot({ campaigns, thresholds }: Props) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>ROAS vs Investimento</div>
      <div style={{ fontSize: 11, color: 'var(--text-hint)', marginBottom: 12 }}>Cada ponto = 1 campanha · Cor = veredicto · Acima da linha verde = saudável</div>
      <ResponsiveContainer width="100%" height={260}>
        <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="spend" type="number" name="Investimento"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} />
          <YAxis dataKey="roas" type="number" name="ROAS"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => `${v}x`} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={thresholds.roas_green} stroke="#16A34A" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: `ROAS ${thresholds.roas_green}x`, position: 'right', fontSize: 10, fill: '#16A34A' }} />
          <ReferenceLine y={thresholds.roas_yellow} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1} />
          <Scatter data={campaigns} fillOpacity={0.85}>
            {campaigns.map((c, i) => (
              <Cell key={i} fill={SIGNAL_COLORS[c.signal]} r={Math.max(6, Math.min(14, Math.sqrt(c.leads) * 1.2))} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
