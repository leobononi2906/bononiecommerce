import { useState } from 'react'
import { Save, RotateCcw } from 'lucide-react'
import { getDefaults, type CampaignThresholds } from '../../lib/thresholds'
import { useThresholds } from '../../hooks/use-thresholds'

const font = { fontFamily: 'DM Sans, sans-serif' }
const inp: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, fontFamily: 'DM Mono, monospace' }

const FIELDS: { key: keyof CampaignThresholds; label: string; suffix: string }[] = [
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4, ...font }}>
              {f.label} <span style={{ fontWeight: 400 }}>({f.suffix})</span>
            </label>
            <input
              type="number"
              step={f.suffix === '%' ? 0.5 : 1}
              value={form[f.key]}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
              style={inp}
            />
          </div>
        ))}
      </div>
      {msg && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', marginBottom: 8, ...font }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--blue-dark)', background: '#EFF6FF', color: 'var(--blue-dark)', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...font }}>
          <Save size={13} /> Salvar limiares
        </button>
        <button onClick={handleReset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 500, cursor: 'pointer', ...font }}>
          <RotateCcw size={13} /> Restaurar padrão
        </button>
      </div>
    </div>
  )
}
