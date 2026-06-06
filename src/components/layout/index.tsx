import type { Periodo } from '../../types'

const OPTIONS: { value: Periodo; label: string }[] = [
  { value: 'mes_atual',    label: 'Mês atual' },
  { value: 'mes_anterior', label: 'Mês anterior' },
  { value: '3_meses',      label: 'Últimos 3 meses' },
  { value: '6_meses',      label: 'Últimos 6 meses' },
]

interface Props {
  value: Periodo
  onChange: (p: Periodo) => void
}

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 'var(--radius)' }}>
      {OPTIONS.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          style={{
            padding: '5px 12px',
            borderRadius: 8,
            border: 'none',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            background: value === o.value ? 'var(--surface)' : 'transparent',
            color: value === o.value ? 'var(--blue-dark)' : 'var(--text-muted)',
            boxShadow: value === o.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
            fontFamily: 'DM Sans, sans-serif',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h1>
      {children}
    </div>
  )
}

export function KpiGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gap: 12,
      marginBottom: 20,
    }}>
      {children}
    </div>
  )
}

export function Row({ children, gap = 16 }: { children: React.ReactNode; gap?: number }) {
  return (
    <div style={{ display: 'flex', gap, marginBottom: 16 }}>
      {children}
    </div>
  )
}

export function Col({ children, flex = 1 }: { children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ flex, minWidth: 0 }}>
      {children}
    </div>
  )
}

import React from 'react'

export function FunnelBar({ label, value, total, color = 'var(--blue-mid)' }: {
  label: string; value: number; total: number; color?: string
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 90, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>{label}</div>
      <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 3, height: 16, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 3, width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ width: 52, fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'DM Mono, monospace' }}>
        {value.toLocaleString('pt-BR')}
      </div>
    </div>
  )
}
