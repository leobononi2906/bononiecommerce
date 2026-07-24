import type { CampaignThresholds } from '../../lib/thresholds'

interface Props {
  value: number
  thresholds: CampaignThresholds
}

export default function GoldilocksGauge({ value, thresholds: t }: Props) {
  const max = 10
  const pct = Math.min(Math.max(value, 0), max) / max * 100

  const z1 = (t.invest_fat_min / max) * 100
  const z2 = (t.invest_fat_ideal_min / max) * 100
  const z3 = (t.invest_fat_ideal_max / max) * 100
  const z4 = (t.invest_fat_max / max) * 100

  const label =
    value < t.invest_fat_min ? 'Investindo pouco' :
    value <= t.invest_fat_ideal_max ? (value >= t.invest_fat_ideal_min ? 'Ideal' : 'Atenção') :
    value <= t.invest_fat_max ? 'Atenção' : 'Acima do limite'

  const labelColor =
    value < t.invest_fat_min ? 'var(--blue-mid)' :
    value >= t.invest_fat_ideal_min && value <= t.invest_fat_ideal_max ? 'var(--green)' :
    value <= t.invest_fat_max ? 'var(--amber)' : 'var(--red)'

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-hint)' }}>% Investimento / Faturamento</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: labelColor }}>{value.toFixed(1)}%</span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20, background: labelColor + '18', color: labelColor }}>{label}</span>
        </div>
      </div>

      {/* Gauge bar */}
      <div style={{ position: 'relative', height: 18, borderRadius: 20, overflow: 'hidden', background: '#F1F5F9' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${z1}%`, background: 'var(--blue-mid)', opacity: 0.2, borderRadius: '20px 0 0 20px' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${z1}%`, width: `${z2 - z1}%`, background: 'var(--amber)', opacity: 0.15 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${z2}%`, width: `${z3 - z2}%`, background: 'var(--green)', opacity: 0.25 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${z3}%`, width: `${z4 - z3}%`, background: 'var(--amber)', opacity: 0.15 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${z4}%`, right: 0, background: 'var(--red)', opacity: 0.15, borderRadius: '0 20px 20px 0' }} />
        {/* Needle */}
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${pct}%`, width: 3, background: labelColor, borderRadius: 2, boxShadow: `0 0 8px ${labelColor}` }}>
          <div style={{ position: 'absolute', top: -3, left: -5, width: 13, height: 13, borderRadius: '50%', border: '2px solid #fff', background: labelColor }} />
        </div>
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--text-hint)' }}>
        <span>0%</span>
        <span>{t.invest_fat_min}%</span>
        <span style={{ color: 'var(--green)', fontWeight: 600 }}>{t.invest_fat_ideal_min}–{t.invest_fat_ideal_max}%</span>
        <span>{t.invest_fat_max}%</span>
        <span>10%</span>
      </div>
    </div>
  )
}
