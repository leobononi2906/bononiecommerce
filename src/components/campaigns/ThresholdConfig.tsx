import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { getDefaults, type CampaignThresholds } from '../../lib/thresholds'
import { useThresholds } from '../../hooks/use-thresholds'

const FIELDS: { key: keyof CampaignThresholds; label: string; suffix: string; step?: number }[] = [
  { key: 'roas_green',          label: 'ROAS bom (verde)',           suffix: 'x' },
  { key: 'roas_yellow',         label: 'ROAS alerta (amarelo)',      suffix: 'x' },
  { key: 'cpl_green',           label: 'CPL bom (verde)',            suffix: 'R$' },
  { key: 'cpl_yellow',          label: 'CPL alerta (amarelo)',       suffix: 'R$' },
  { key: 'conv_green',          label: 'Conversão boa',             suffix: '%' },
  { key: 'conv_yellow',         label: 'Conversão alerta',          suffix: '%' },
  { key: 'invest_fat_min',      label: '% Invest/Fat mínimo',       suffix: '%' },
  { key: 'invest_fat_ideal_min',label: '% Invest/Fat ideal (mín)',  suffix: '%' },
  { key: 'invest_fat_ideal_max',label: '% Invest/Fat ideal (máx)',  suffix: '%' },
  { key: 'invest_fat_max',      label: '% Invest/Fat máximo',       suffix: '%' },
  { key: 'min_spend_for_verdict',label: 'Gasto mín. p/ veredicto',  suffix: 'R$' },
  { key: 'tmr_green',           label: 'TMR bom',                   suffix: 'min' },
  { key: 'tmr_yellow',          label: 'TMR alerta',                suffix: 'min' },
]

export default function ThresholdConfig() {
  const { thresholds, save } = useThresholds()
  const [form, setForm] = useState<CampaignThresholds>({ ...thresholds })
  const [msg, setMsg] = useState('')

  function handleSave() {
    save(form)
    setMsg('Salvo!')
    setTimeout(() => setMsg(''), 2000)
  }

  function handleReset() {
    const defaults = getDefaults()
    setForm(defaults)
    save(defaults)
    setMsg('Restaurado para padrão!')
    setTimeout(() => setMsg(''), 2000)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-3" style={{ fontFamily: 'DM Sans' }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-txt-hint mb-1">
              {f.label} <span className="text-txt-muted font-normal">({f.suffix})</span>
            </label>
            <input
              type="number"
              step={f.step || (f.suffix === '%' ? 0.5 : 1)}
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
              className="w-full px-2.5 py-1.5 border border-border rounded-lg text-[13px] font-mono"
              style={{ fontFamily: 'DM Mono, monospace' }}
            />
          </div>
        ))}
      </div>
      {msg && <div className="text-xs font-semibold mb-2" style={{ color: 'var(--green)' }}>{msg}</div>}
      <div className="flex gap-2">
        <button onClick={handleSave}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: '#EFF6FF', color: 'var(--blue-dark)', border: '1px solid var(--blue-dark)', fontFamily: 'DM Sans', cursor: 'pointer' }}>
          <Save size={13} /> Salvar limiares
        </button>
        <button onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border)', fontFamily: 'DM Sans', cursor: 'pointer' }}>
          <RotateCcw size={13} /> Restaurar padrão
        </button>
      </div>
    </div>
  )
}
