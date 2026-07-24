import { usePeriodo } from '../components/layout/AppShell'
import { useCampaignVerdicts, useSubgroupAnalysis, useCampaignDetails } from '../hooks/use-campaigns'
import { useThresholds } from '../hooks/use-thresholds'
import { KpiCard, Spinner, SectionLabel } from '../components/ui'
import { KpiGrid } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import GoldilocksGauge from '../components/campaigns/GoldilocksGauge'
import CampaignScatterPlot from '../components/campaigns/ScatterPlot'
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
    <div className="p-5 max-w-[1400px]" style={{ fontFamily: 'DM Sans' }}>
      {/* Gauge — big picture */}
      <GoldilocksGauge value={summary.pctInvestFat} thresholds={thresholds} />

      {/* KPIs */}
      <div className="mt-4">
        <SectionLabel>Performance geral — atribuição real (TikTim × ERP, excluindo marketplace)</SectionLabel>
        <KpiGrid cols={5}>
          <KpiCard label="Investimento Meta" value={fmtBRL(summary.totalSpend)} highlight />
          <KpiCard label="Receita atribuída" value={fmtBRL(summary.totalRevenue)}
            sub={`${fmtNum(summary.totalVendas)} vendas confirmadas`} />
          <KpiCard label="ROAS real" value={summary.overallRoas > 0 ? `${summary.overallRoas.toFixed(1)}x` : '–'}
            sub={summary.overallRoas >= thresholds.roas_green ? 'Saudável' : summary.overallRoas >= thresholds.roas_yellow ? 'Atenção' : 'Abaixo do alvo'}
            trend={summary.overallRoas >= thresholds.roas_green ? 'up' : summary.overallRoas >= thresholds.roas_yellow ? 'neutral' : 'down'} />
          <KpiCard label="CPA real" value={summary.overallCpa > 0 ? fmtBRL(summary.overallCpa) : '–'}
            sub="Custo por venda" />
          <KpiCard label="CPL" value={summary.overallCpl > 0 ? fmtBRL(summary.overallCpl) : '–'}
            sub={`${fmtNum(summary.totalLeads)} leads`} />
        </KpiGrid>
      </div>

      {/* Scatter plot */}
      <div className="mt-4">
        <CampaignScatterPlot campaigns={campaigns} thresholds={thresholds} />
      </div>

      {/* Campaign table with verdicts */}
      <div className="mt-4">
        <SectionLabel>Veredicto por campanha</SectionLabel>
        <CampaignTable campaigns={campaigns} details={details || []} summary={summary} />
      </div>

      {/* Subgroup analysis */}
      <div className="mt-4">
        <SectionLabel>Investimento × Faturamento por subgrupo</SectionLabel>
        <SubgroupTable data={subgroups} />
      </div>
    </div>
  )
}
