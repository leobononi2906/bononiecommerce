import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useVendedores, useSubgrupos, useLeads, useFaturamento6Meses, useFaturamentoPeriodo } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct, mesAbrev, shortName } from '../lib/fmt'
import type { Periodo } from '../types'

// IDs dos vendedores do marketplace (ML Battogo, ML Bononi Full, ML Bononi, Shopee)
const MKT_IDS = new Set([53353, 53354, 53352, 55352])

interface Props { periodo: Periodo }

export default function Home({ periodo }: Props) {
  const { data: vendedores }              = useVendedores()
  const { data: subgrupos,  loading: ls } = useSubgrupos(periodo)
  const { data: leads,      loading: ll } = useLeads(periodo)
  const { data: fatRaw,     loading: lf } = useFaturamento6Meses()
  const { data: fatPeriodo, loading: lfp} = useFaturamentoPeriodo(periodo)

  // ── 3 cards de faturamento por canal ──
  const canais = useMemo(() => {
    if (!fatPeriodo) return { vendedores: 0, site: 0, marketplace: 0, total: 0, docs: 0 }
    let vendedoresF = 0, siteF = 0, marketplaceF = 0, total = 0, docs = 0
    fatPeriodo.forEach((r: any) => {
      const fat = Number(r.faturamento_doc)
      const id  = Number(r.id_vendedor)
      total += fat
      docs++
      if (MKT_IDS.has(id)) { marketplaceF += fat }
      else if (r.tipo_saida === 'ONLINE') {
        // ONLINE mas nao marketplace = vendedor ecommerce via site
        siteF += fat
      }
    })
    vendedoresF = total - marketplaceF - siteF
    return { vendedores: vendedoresF, site: siteF, marketplace: marketplaceF, total, docs }
  }, [fatPeriodo])

  const leadCount = leads?.length ?? 0

  const topSubgrupos = useMemo(() => {
    if (!subgrupos) return []
    const map = new Map<string, number>()
    subgrupos.forEach(s => map.set(s.subgrupo, (map.get(s.subgrupo)||0) + s.faturamento))
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([nome,fat])=>({nome,fat}))
  }, [subgrupos])

  const topVendedores = useMemo(() => {
    if (!fatPeriodo) return []
    const map = new Map<string, {fat:number; nome:string}>()
    fatPeriodo.forEach((r:any) => {
      if (MKT_IDS.has(Number(r.id_vendedor))) return
      const k = String(r.id_vendedor)
      const cur = map.get(k) || {fat:0, nome:r.nome_vendedor}
      cur.fat += Number(r.faturamento_doc)
      map.set(k, cur)
    })
    return [...map.values()].sort((a,b)=>b.fat-a.fat).slice(0,5)
  }, [fatPeriodo])

  // 6 months chart data
  const fat6Vendedor = useMemo(() => {
    if (!fatRaw) return []
    const byMesVend: Record<string,Record<string,number>> = {}
    const meses = new Set<string>()
    fatRaw.forEach((r:any) => {
      const mes  = mesAbrev(r.data_faturamento)
      const vend = shortName(r.nome_vendedor||'')
      meses.add(mes)
      if (!byMesVend[mes]) byMesVend[mes] = {}
      byMesVend[mes][vend] = (byMesVend[mes][vend]||0) + Number(r.faturamento_doc)
    })
    return [...meses].sort().map(mes=>({mes,...byMesVend[mes]}))
  }, [fatRaw])

  const top5Vend = useMemo(() => {
    if (!fatRaw) return []
    const map = new Map<string,number>()
    fatRaw.forEach((r:any)=>{ const k=shortName(r.nome_vendedor||''); map.set(k,(map.get(k)||0)+Number(r.faturamento_doc)) })
    return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k])=>k)
  }, [fatRaw])

  const COLORS = ['#1A3A8F','#0077CC','#00AAEE','#60A5FA','#93C5FD']

  const fat6Depto = useMemo(() => {
    if (!fatRaw) return []
    const map: Record<string,Record<string,number>> = {}
    const meses = new Set<string>()
    fatRaw.forEach((r:any) => {
      const mes   = mesAbrev(r.data_faturamento)
      const depto = (r.departamento as string)||'Outros'
      meses.add(mes)
      if (!map[mes]) map[mes]={}
      map[mes][depto] = (map[mes][depto]||0) + Number(r.faturamento_doc)
    })
    return [...meses].sort().map(mes=>({mes,...map[mes]}))
  }, [fatRaw])

  const deptos = useMemo(()=>{const s=new Set<string>(); fatRaw?.forEach((r:any)=>s.add((r.departamento as string)||'Outros')); return [...s]}, [fatRaw])
  const DEPTO_COLORS: Record<string,string> = {'ECOMMERCE':'#1A3A8F','ECOMMERCE MKT PLACE':'#0077CC','ECOMMERCE SITE':'#00AAEE','ADMINISTRATIVO':'#60A5FA','DISTRIBUIDOR':'#93C5FD','Outros':'#CBD5E1'}

  return (
    <div style={{ padding:'24px 28px', maxWidth:1400 }}>
      <PageHeader title="Visão Geral" />

      <SectionLabel>Faturamento por canal — {periodo.replace('_',' ')}</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Faturamento Vendedores" value={lfp ? '...' : fmtBRL(canais.site)} sub="Vendas ONLINE (site)" icon="🛒" highlight />
        <KpiCard label="Faturamento Marketplace" value={lfp ? '...' : fmtBRL(canais.marketplace)} sub="ML Battogo, ML Bononi, Shopee" icon="🏪" />
        <KpiCard label="Total ONLINE" value={lfp ? '...' : fmtBRL(canais.total)} sub={`${fmtNum(canais.docs)} documentos`} icon="💰" />
      </KpiGrid>

      <SectionLabel>KPIs gerais</SectionLabel>
      <KpiGrid cols={3}>
        <KpiCard label="Leads (período)" value={ll ? '...' : fmtNum(leadCount)} icon="👥" />
        <KpiCard label="Vendedores ativos" value={String(topVendedores.length)} icon="👤" />
        <KpiCard label="Top subgrupo" value={ls ? '...' : (topSubgrupos[0]?.nome || '–')} sub={topSubgrupos[0] ? fmtBRL(topSubgrupos[0].fat) : ''} icon="📦" />
      </KpiGrid>

      <Row>
        <Col flex={6}>
          <Card>
            <CardTitle>Top subgrupos — faturamento</CardTitle>
            {ls ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topSubgrupos} margin={{top:0,right:0,left:0,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" tick={{fontSize:11,fill:'var(--text-muted)'}} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={70} />
                  <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--border)'}} />
                  <Bar dataKey="fat" name="Faturamento" fill="var(--blue-mid)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
        <Col flex={4}>
          <Card>
            <CardTitle>Top vendedores — período</CardTitle>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr>{['#','Vendedor','Fat.'].map((h,i)=>(
                  <th key={i} style={{textAlign:i<2?'left':'right',padding:'4px 6px',fontSize:11,color:'var(--text-hint)',fontWeight:600,borderBottom:'1px solid var(--border)',textTransform:'uppercase'}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {topVendedores.map((v,i)=>(
                  <tr key={i} style={{borderBottom:i<topVendedores.length-1?'1px solid var(--border)':'none'}}>
                    <td style={{padding:'7px 6px',color:'var(--text-hint)',fontSize:11}}>{i+1}</td>
                    <td style={{padding:'7px 6px',fontWeight:500}}>{shortName(v.nome)}</td>
                    <td style={{padding:'7px 6px',textAlign:'right',fontFamily:'DM Mono, monospace',fontSize:12}}>{fmtBRL(v.fat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </Col>
      </Row>

      <SectionLabel>Faturamento — últimos 6 meses (ONLINE)</SectionLabel>
      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Por vendedor</CardTitle>
            {lf ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fat6Vendedor} margin={{top:0,right:0,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--text-muted)'}} />
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72} />
                  <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--border)'}} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  {top5Vend.map((v,i)=>(
                    <Bar key={v} dataKey={v} stackId="a" fill={COLORS[i%COLORS.length]} radius={i===top5Vend.length-1?[4,4,0,0]:undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
      <Row>
        <Col flex={1}>
          <Card>
            <CardTitle>Por departamento</CardTitle>
            {lf ? <Spinner /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={fat6Depto} margin={{top:0,right:0,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" tick={{fontSize:11,fill:'var(--text-muted)'}} />
                  <YAxis tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>fmtBRL(v)} width={72} />
                  <Tooltip formatter={(v:number)=>fmtBRL(v)} contentStyle={{fontSize:12,borderRadius:8,border:'1px solid var(--border)'}} />
                  <Legend wrapperStyle={{fontSize:11}} />
                  {deptos.map((d,i)=>(
                    <Bar key={d} dataKey={d} stackId="b" fill={DEPTO_COLORS[d]||COLORS[i%COLORS.length]} radius={i===deptos.length-1?[4,4,0,0]:undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
