import { usePeriodo } from '../components/layout/AppShell'
import { useCampaignVerdicts, useSubgroupAnalysis, useCampaignDetails } from '../hooks/use-campaigns'
import { useThresholds } from '../hooks/use-thresholds'
import { KpiCard, Spinner, SectionLabel } from '../components/ui'
import { KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import GoldilocksGauge from '../components/campaigns/GoldilocksGauge'
import CampaignTable from '../components/campaigns/CampaignTable'
import SubgroupTable from '../components/campaigns/SubgroupTable'

export default function Campanhas() {
  const { periodo } = usePeriodo()
  const { thresholds } = useThresholds()
  const { campaigns, summary, loading } = useCampaignVerdicts(periodo)
  const { data: details } = useCampaignDetails()
  const subgroups = useSubgroupAnalysis(periodo)

  if (loading) return <Spinner />

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
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
