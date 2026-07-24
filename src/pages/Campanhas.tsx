import { usePeriodo } from '../components/layout/AppShell'
import { useCampaignVerdicts, useSubgroupAnalysis, useCampaignDetails } from '../hooks/use-campaigns'
import { useThresholds } from '../hooks/use-thresholds'
import { KpiCard, Spinner, SectionLabel } from '../components/ui'
import { KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtNum } from '../lib/fmt'
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
    <div style={{ padding: '20px 24px', maxWidth: 1400 }}>
      {/* Gauge + KPIs lado a lado */}
      <Row gap={16}>
        <Col flex={5}>
          <GoldilocksGauge value={summary.pctInvestFat} thresholds={thresholds} />
        </Col>
        <Col flex={7}>
          <SectionLabel>Performance geral — atribuição real (excl. marketplace)</SectionLabel>
          <KpiGrid cols={4}>
            <KpiCard label="Investimento Meta" value={fmtBRL(summary.totalSpend)} highlight />
            <KpiCard label="Receita atribuída" value={fmtBRL(summary.totalRevenue)}
              sub={`${fmtNum(summary.totalVendas)} vendas`} />
            <KpiCard label="ROAS real" value={summary.overallRoas > 0 ? `${summary.overallRoas.toFixed(1)}x` : '–'}
              sub={summary.overallRoas >= thresholds.roas_green ? 'Saudável' : summary.overallRoas >= thresholds.roas_yellow ? 'Atenção' : 'Abaixo do alvo'}
              trend={summary.overallRoas >= thresholds.roas_green ? 'up' : summary.overallRoas >= thresholds.roas_yellow ? 'neutral' : 'down'} />
            <KpiCard label="CPA real" value={summary.overallCpa > 0 ? fmtBRL(summary.overallCpa) : '–'}
              sub={`CPL: ${summary.overallCpl > 0 ? fmtBRL(summary.overallCpl) : '–'}`} />
          </KpiGrid>
        </Col>
      </Row>

      {/* Scatter plot */}
      <div style={{ marginBottom: 16 }}>
        <CampaignScatterPlot campaigns={campaigns} thresholds={thresholds} />
      </div>

      {/* Campaign table with verdicts */}
      <SectionLabel>Veredicto por campanha</SectionLabel>
      <div style={{ marginBottom: 16 }}>
        <CampaignTable campaigns={campaigns} details={details || []} summary={summary} />
      </div>

      {/* Subgroup analysis */}
      <SectionLabel>Investimento × Faturamento por subgrupo</SectionLabel>
      <SubgroupTable data={subgroups} />
    </div>
  )
}
