import type { CampaignThresholds } from '../../lib/thresholds'

interface Props {
  value: number
  thresholds: CampaignThresholds
}

export default function GoldilocksGauge({ value, thresholds: t }: Props) {
  const max = 10
  const pct = Math.min(Math.max(value, 0), max) / max * 100

  // Zone boundaries as percentages
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
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-txt-hint">% Investimento / Faturamento</span>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold font-mono" style={{ color: labelColor }}>
            {value.toFixed(1)}%
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: labelColor + '18', color: labelColor }}>
            {label}
          </span>
        </div>
      </div>

      {/* Gauge bar */}
      <div className="relative h-5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
        {/* Zone colors */}
        <div className="absolute inset-y-0 left-0 rounded-l-full" style={{ width: `${z1}%`, background: 'var(--blue-mid)', opacity: 0.2 }} />
        <div className="absolute inset-y-0" style={{ left: `${z1}%`, width: `${z2 - z1}%`, background: 'var(--amber)', opacity: 0.15 }} />
        <div className="absolute inset-y-0" style={{ left: `${z2}%`, width: `${z3 - z2}%`, background: 'var(--green)', opacity: 0.2 }} />
        <div className="absolute inset-y-0" style={{ left: `${z3}%`, width: `${z4 - z3}%`, background: 'var(--amber)', opacity: 0.15 }} />
        <div className="absolute inset-y-0 rounded-r-full" style={{ left: `${z4}%`, right: 0, background: 'var(--red)', opacity: 0.15 }} />

        {/* Needle */}
        <div className="absolute top-0 bottom-0 w-0.5" style={{ left: `${pct}%`, background: labelColor, boxShadow: `0 0 6px ${labelColor}` }}>
          <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: labelColor }} />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-1.5 text-[10px] text-txt-hint">
        <span>0%</span>
        <span style={{ marginLeft: `${z1 - 3}%` }}>{t.invest_fat_min}%</span>
        <span>{t.invest_fat_ideal_min}–{t.invest_fat_ideal_max}%</span>
        <span>{t.invest_fat_max}%</span>
        <span>10%</span>
      </div>
    </div>
  )
}
