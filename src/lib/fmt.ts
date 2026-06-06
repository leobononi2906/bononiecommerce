export function fmtBRL(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'R$ 0'
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtBRLFull(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'R$ 0'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value == null || isNaN(value)) return '0%'
  return `${Number(value).toFixed(decimals)}%`
}

export function fmtNum(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0'
  return Math.round(value).toLocaleString('pt-BR')
}

export function fmtHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '–'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes == null || isNaN(minutes)) return '–'
  if (minutes < 60) return `${Math.round(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export function shortName(fullName: string): string {
  if (!fullName) return '–'
  const parts = fullName.trim().split(' ')
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export function mesAbrev(isoDate: string): string {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const d = new Date(isoDate + 'T12:00:00')
  return `${months[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`
}
