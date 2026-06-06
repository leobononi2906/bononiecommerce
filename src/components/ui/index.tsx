import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  highlight?: boolean
}

export function KpiCard({ label, value, sub, trend, icon, highlight }: KpiCardProps) {
  return (
    <div style={{
      background: highlight ? 'var(--blue-dark)' : 'var(--surface)',
      border: `1px solid ${highlight ? 'var(--blue-dark)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-lg)',
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ color: highlight ? '#93C5FD' : 'var(--text-hint)', fontSize: 14 }}>{icon}</span>}
        <span style={{ fontSize: 11, fontWeight: 500, color: highlight ? '#93C5FD' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
      </div>
      <span style={{ fontSize: 22, fontWeight: 600, color: highlight ? '#FFFFFF' : 'var(--text-primary)', fontFamily: 'DM Mono, monospace', letterSpacing: '-0.5px' }}>
        {value}
      </span>
      {sub && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up' && <TrendingUp size={12} color="var(--green)" />}
          {trend === 'down' && <TrendingDown size={12} color="var(--red)" />}
          {trend === 'neutral' && <Minus size={12} color="var(--text-hint)" />}
          <span style={{ fontSize: 12, color: trend === 'up' ? 'var(--green)' : trend === 'down' ? 'var(--red)' : 'var(--text-muted)' }}>
            {sub}
          </span>
        </div>
      )}
    </div>
  )
}

interface BadgeProps {
  value: string | number
  type?: 'ok' | 'warn' | 'err' | 'info' | 'neutral'
}

export function Badge({ value, type = 'neutral' }: BadgeProps) {
  const styles: Record<string, { bg: string; color: string }> = {
    ok:      { bg: 'var(--green-bg)',  color: 'var(--green)' },
    warn:    { bg: 'var(--amber-bg)',  color: 'var(--amber)' },
    err:     { bg: 'var(--red-bg)',    color: 'var(--red)' },
    info:    { bg: '#EFF6FF',          color: 'var(--blue-mid)' },
    neutral: { bg: '#F1F5F9',          color: 'var(--text-muted)' },
  }
  const s = styles[type]
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: s.bg,
      color: s.color,
    }}>
      {value}
    </span>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
      <div style={{
        width: 24, height: 24,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--blue-mid)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, marginTop: 4 }}>
      {children}
    </div>
  )
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 16,
      ...style,
    }}>
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14 }}>
      {children}
    </div>
  )
}

export function AlertBanner({ type, children }: { type: 'error' | 'warning'; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      borderRadius: 'var(--radius)',
      border: `1px solid ${type === 'error' ? '#FECACA' : '#FDE68A'}`,
      background: type === 'error' ? 'var(--red-bg)' : 'var(--amber-bg)',
      fontSize: 12,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: type === 'error' ? 'var(--red)' : 'var(--amber)', flexShrink: 0 }} />
      {children}
    </div>
  )
}

interface TableProps {
  headers: string[]
  rows: React.ReactNode[][]
  compact?: boolean
}

export function Table({ headers, rows, compact }: TableProps) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: compact ? 12 : 13 }}>
      <thead>
        <tr>
          {headers.map((h, i) => (
            <th key={i} style={{
              textAlign: i === 0 ? 'left' : 'right',
              padding: compact ? '4px 6px' : '6px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-hint)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              borderBottom: '1px solid var(--border)',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {row.map((cell, j) => (
              <td key={j} style={{
                textAlign: j === 0 ? 'left' : 'right',
                padding: compact ? '5px 6px' : '8px 8px',
                color: 'var(--text-primary)',
              }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
