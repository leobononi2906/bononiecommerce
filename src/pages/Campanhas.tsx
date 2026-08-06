import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { usePeriodo } from '../components/layout/AppShell'
import { useCampaignVerdicts, useSubgroupAnalysis, useCampaignDetails, useMetaAdsMensal } from '../hooks/use-campaigns'
import { useThresholds } from '../hooks/use-thresholds'
import { KpiCard, Spinner, SectionLabel, Card, CardTitle } from '../components/ui'
import { KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import GoldilocksGauge from '../components/campaigns/GoldilocksGauge'
import CampaignTable from '../components/campaigns/CampaignTable'
import SubgroupTable from '../components/campaigns/SubgroupTable'

function mesInfo(iso: string): { label: string; sortKey: string } {
  const d = new Date(iso + 'T12:00:00')
  const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][d.getMonth()] + '/' + String(d.getFullYear()).slice(2)
  return { label, sortKey: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
}

export default function Campanhas() {
  const { periodo } = usePeriodo()
  const { thresholds } = useThresholds()
  const { campaigns, summary, loading } = useCampaignVerdicts(periodo)
  const { data: details } = useCampaignDetails(periodo)
  const { data: mensal } = useMetaAdsMensal()
  const subgroups = useSubgroupAnalysis(periodo)

  // Tendência mensal de investimento (últimos 6 meses)
  const trend = useMemo(() => {
    if (!mensal) return [] as { mes: string; investimento: number; leads: number }[]
    const by = new Map<string, { label: string; inv: number; leads: number }>()
    mensal.forEach(r => {
      const { label, sortKey } = mesInfo(r.data)
      const e = by.get(sortKey) || { label, inv: 0, leads: 0 }
      e.inv += r.investimento; e.leads += r.leads
      by.set(sortKey, e)
    })
    return [...by.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([, e]) => ({ mes: e.label, investimento: e.inv, leads: e.leads }))
  }, [mensal])

  // Aviso de mês em andamento (só faz sentido no "mes_atual")
  const hoje = new Date()
  const diaAtual = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const mesParcial = periodo === 'mes_atual' && diaAtual < diasNoMes

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      {mesParcial && (
        <div style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid #FCE3B0', borderRadius: 'var(--radius)', padding: '9px 14px', marginBottom: 14, fontSize: 12.5 }}>
          📅 Mês em andamento — dados parciais de {diaAtual}/{diasNoMes} dias. Os números crescem ao longo do mês; use o filtro de período para comparar com meses fechados.
        </div>
      )}

      {/* Tendência de investimento */}
      <SectionLabel>Investimento em mídia — últimos 6 meses</SectionLabel>
      <Card style={{ marginBottom: 20 }}>
        <CardTitle>Meta Ads por mês (todas as campanhas)</CardTitle>
        {!mensal ? <Spinner /> : trend.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-hint)', padding: '8px 0' }}>Sem dados de mídia no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={v => fmtBRL(v)} width={64} />
              <Tooltip formatter={(v: number, n: string) => n === 'investimento' ? fmtBRL(v) : fmtNum(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="investimento" name="Investimento" fill="var(--blue-mid)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* KPIs */}
      <SectionLabel>Performance geral — atribuicao real (excl. marketplace)</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Investimento Meta" value={fmtBRL(summary.totalSpend)} highlight />
        <KpiCard label="Receita atribuida" value={fmtBRL(summary.totalRevenue)}
          sub={`${fmtNum(summary.totalVendas)} vendas`} />
        <KpiCard label="% Invest / Faturamento"
          value={summary.pctInvestFat > 0 ? fmtPct(summary.pctInvestFat, 1) : '–'}
          sub={summary.pctInvestFat >= 5 && summary.pctInvestFat <= 6 ? 'Zona ideal' : summary.pctInvestFat < 4 ? 'Investindo pouco' : summary.pctInvestFat <= 7 ? 'Atencao' : 'Acima do limite'}
          trend={summary.pctInvestFat >= 5 && summary.pctInvestFat <= 6 ? 'up' : summary.pctInvestFat < 4 || summary.pctInvestFat > 7 ? 'down' : 'neutral'} />
        <KpiCard label="ROAS real" value={summary.overallRoas > 0 ? `${summary.overallRoas.toFixed(1)}x` : '–'}
          sub={`CPA: ${summary.overallCpa > 0 ? fmtBRL(summary.overallCpa) : '–'}`}
          trend={summary.overallRoas >= thresholds.roas_green ? 'up' : summary.overallRoas >= thresholds.roas_yellow ? 'neutral' : 'down'} />
      </KpiGrid>

      {/* Gauge */}
      <div style={{ marginBottom: 20 }}>
        <GoldilocksGauge value={summary.pctInvestFat} thresholds={thresholds} />
      </div>

      {/* Tabela de campanhas */}
      <SectionLabel>Veredicto por campanha</SectionLabel>
      <div style={{ marginBottom: 20 }}>
        <CampaignTable campaigns={campaigns} details={details || []} summary={summary} />
      </div>

      {/* Subgrupos */}
      <SectionLabel>Investimento x Faturamento por subgrupo</SectionLabel>
      <SubgroupTable data={subgroups} />
    </div>
  )
}
