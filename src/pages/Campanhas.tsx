import React, { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from 'recharts'
import { useMetaAds, useCampanhaSubgrupos, useOrigemLeads } from '../hooks/useData'
import { KpiCard, Badge, Spinner, Card, CardTitle, SectionLabel } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col, FunnelBar } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import type { Periodo } from '../types'

function shortCamp(name: string, maxLen = 38): string {
  const clean = name.replace(/\[[\d\/]+\]\s*/g,'').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen)+'…' : clean
}

const PRODUTO_COR: Record<string, string> = {
  'Ar Condicionado': '#1A3A8F',
  'Gerador':         '#0077CC',
  'Combo AC+Gerador':'#7C3AED',
  'Geladeira':       '#059669',
  'Outros':          '#94A3B8',
}

interface Props { periodo: Periodo }

export default function Campanhas({ periodo }: Props) {
  const { data: metaAds,  loading: lmeta  } = useMetaAds(periodo)
  const { data: campSub                   } = useCampanhaSubgrupos()
  const { data: origem,   loading: lorigem } = useOrigemLeads(periodo)

  // ── KPIs Meta Ads ─────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!metaAds) return null
    const invest = metaAds.reduce((s,r)=>s+r.investimento, 0)
    const leads  = metaAds.reduce((s,r)=>s+(r.leads||0), 0)
    const impres = metaAds.reduce((s,r)=>s+r.impressoes, 0)
    const clicks = metaAds.reduce((s,r)=>s+r.cliques, 0)
    const ctr    = impres>0 ? (clicks/impres)*100 : 0
    const cpl    = leads>0 ? invest/leads : 0
    return { invest, leads, cpl, ctr, impres, clicks }
  }, [metaAds])

  // ── Origem leads: agrupa por produto ──────────────────────
  const porProduto = useMemo(() => {
    if (!origem) return []
    const map = new Map<string,{leads:number;investimento:number}>()
    origem.forEach(r => {
      const cur = map.get(r.produto) || {leads:0, investimento:0}
      cur.leads       += r.leads
      cur.investimento += r.investimento
      map.set(r.produto, cur)
    })
    return [...map.entries()]
      .map(([produto, d]) => ({
        produto,
        leads: d.leads,
        investimento: d.investimento,
        cpl: d.leads > 0 ? d.investimento / d.leads : 0,
        cor: PRODUTO_COR[produto] || '#94A3B8',
      }))
      .sort((a,b) => b.leads - a.leads)
  }, [origem])

  // ── Origem leads: agrupa por campanha ─────────────────────
  const porCampanha = useMemo(() => {
    if (!origem) return []
    const map = new Map<string,{produto:string;leads:number;investimento:number;conjuntos:Set<string>}>()
    origem.forEach(r => {
      const cur = map.get(r.campanha) || {produto:r.produto, leads:0, investimento:0, conjuntos: new Set()}
      cur.leads        += r.leads
      cur.investimento += r.investimento
      if (r.conjunto) cur.conjuntos.add(r.conjunto)
      map.set(r.campanha, cur)
    })
    return [...map.entries()]
      .map(([campanha, d]) => ({
        campanha,
        short: shortCamp(campanha),
        produto: d.produto,
        leads: d.leads,
        investimento: d.investimento,
        cpl: d.leads > 0 ? d.investimento / d.leads : 0,
        conjuntos: d.conjuntos.size,
      }))
      .sort((a,b) => b.leads - a.leads)
      .slice(0, 12)
  }, [origem])

  // ── Meta Ads: agrupado por campanha ───────────────────────
  const byCampanhaLegado = useMemo(() => {
    if (!metaAds) return []
    const map = new Map<string,{invest:number;leads:number;impressoes:number;cliques:number}>()
    metaAds.forEach(r => {
      const cur = map.get(r.campanha) || {invest:0,leads:0,impressoes:0,cliques:0}
      cur.invest += r.investimento; cur.leads += (r.leads||0)
      cur.impressoes += r.impressoes; cur.cliques += r.cliques
      map.set(r.campanha, cur)
    })
    return [...map.entries()].map(([nome, d]) => ({
      nome, short: shortCamp(nome),
      invest: d.invest, leads: d.leads,
      cpl: d.leads>0 ? d.invest/d.leads : 0,
      ctr: d.impressoes>0 ? (d.cliques/d.impressoes)*100 : 0,
    })).sort((a,b)=>b.leads-a.leads)
  }, [metaAds])

  const campSubMap = useMemo(() => {
    const m: Record<string,string[]> = {}
    campSub?.forEach(cs => { if (!m[cs.campanha]) m[cs.campanha]=[]; m[cs.campanha].push(cs.subgrupo_produto) })
    return m
  }, [campSub])

  const dailyData = useMemo(() => {
    if (!metaAds) return []
    const map = new Map<string,{invest:number;leads:number}>()
    metaAds.forEach(r => {
      const cur = map.get(r.data)||{invest:0,leads:0}
      cur.invest += r.investimento; cur.leads += (r.leads||0)
      map.set(r.data, cur)
    })
    return [...map.entries()].sort().map(([data,d])=>({data:data.slice(5),...d}))
  }, [metaAds])

  const totalLeadsOrigem = porProduto.reduce((s,r)=>s+r.leads,0)
  const totalInvestOrigem = porProduto.reduce((s,r)=>s+r.investimento,0)

  if (lmeta) return <Spinner />

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '6px 10px', fontSize: 11,
    color: 'var(--text-hint)', fontWeight: 600,
    borderBottom: '1px solid var(--border)', textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = { padding: '7px 10px', fontSize: 13, borderBottom: '1px solid var(--border)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'DM Mono, monospace', fontWeight: 600 }

  return (
    <div style={{padding:'20px 24px', maxWidth:1400}}>
      <PageHeader title="Campanhas" />

      {/* ── Origem dos leads (TinTim) ── */}
      <SectionLabel>Origem dos leads — atribuição TinTim</SectionLabel>

      {lorigem ? <Spinner /> : (
        <>
          {/* Cards por produto */}
          <KpiGrid cols={porProduto.length || 4}>
            {porProduto.map(p => (
              <div key={p.produto} style={{
                background: 'var(--surface)',
                border: `2px solid ${p.cor}22`,
                borderLeft: `4px solid ${p.cor}`,
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
              }}>
                <div style={{fontSize:11, fontWeight:600, color: p.cor, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6}}>
                  {p.produto}
                </div>
                <div style={{fontSize:24, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Mono, monospace'}}>
                  {fmtNum(p.leads)}
                  <span style={{fontSize:13, fontWeight:400, color:'var(--text-muted)', marginLeft:4}}>leads</span>
                </div>
                <div style={{display:'flex', gap:12, marginTop:8}}>
                  <div>
                    <div style={{fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase'}}>Invest.</div>
                    <div style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>{fmtBRL(p.investimento)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase'}}>CPL</div>
                    <div style={{fontSize:13, fontWeight:600, color: p.cor}}>{p.cpl > 0 ? fmtBRL(p.cpl) : '–'}</div>
                  </div>
                  <div>
                    <div style={{fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase'}}>Share</div>
                    <div style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>
                      {totalLeadsOrigem > 0 ? fmtPct(p.leads/totalLeadsOrigem*100) : '–'}
                    </div>
                  </div>
                </div>
                {/* barra de progresso */}
                <div style={{marginTop:10, height:4, background:'#F1F5F9', borderRadius:2, overflow:'hidden'}}>
                  <div style={{height:'100%', background: p.cor, borderRadius:2,
                    width: totalLeadsOrigem > 0 ? `${Math.min(p.leads/totalLeadsOrigem*100,100)}%` : '0%',
                    transition:'width 0.5s ease'}} />
                </div>
              </div>
            ))}
          </KpiGrid>

          {/* Tabela por campanha */}
          {porCampanha.length > 0 && (
            <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:20, overflow:'hidden'}}>
              <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>Ranking de campanhas — leads atribuídos</span>
                <span style={{fontSize:11, color:'var(--text-muted)'}}>
                  {fmtNum(totalLeadsOrigem)} leads · {fmtBRL(totalInvestOrigem)} investido
                </span>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      <th style={th}>Campanha</th>
                      <th style={th}>Produto</th>
                      <th style={{...th, textAlign:'right'}}>Leads</th>
                      <th style={{...th, textAlign:'right'}}>Invest.</th>
                      <th style={{...th, textAlign:'right'}}>CPL real</th>
                      <th style={{...th, textAlign:'right'}}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {porCampanha.map((c, i) => (
                      <tr key={i} style={{background: i%2===0 ? 'transparent' : '#FAFBFC'}}>
                        <td style={{...td, maxWidth:260}}>
                          <span style={{fontSize:12, fontWeight:500, color:'var(--text-primary)'}}>{c.short}</span>
                        </td>
                        <td style={td}>
                          <span style={{
                            display:'inline-block', padding:'2px 8px', borderRadius:20,
                            fontSize:11, fontWeight:600,
                            background: (PRODUTO_COR[c.produto]||'#94A3B8')+'18',
                            color: PRODUTO_COR[c.produto]||'#94A3B8',
                          }}>{c.produto}</span>
                        </td>
                        <td style={tdR}>{fmtNum(c.leads)}</td>
                        <td style={tdR}>{c.investimento > 0 ? fmtBRL(c.investimento) : '–'}</td>
                        <td style={{...tdR, color: c.cpl > 0 ? 'var(--text-primary)' : 'var(--text-hint)'}}>
                          {c.cpl > 0 ? fmtBRL(c.cpl) : '–'}
                        </td>
                        <td style={tdR}>
                          <div style={{display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end'}}>
                            <div style={{width:48, height:4, background:'#F1F5F9', borderRadius:2, overflow:'hidden'}}>
                              <div style={{height:'100%', background: PRODUTO_COR[c.produto]||'#94A3B8', borderRadius:2,
                                width: totalLeadsOrigem > 0 ? `${Math.min(c.leads/totalLeadsOrigem*100,100)}%` : '0%'}} />
                            </div>
                            <span style={{fontSize:12, minWidth:32, textAlign:'right'}}>
                              {totalLeadsOrigem > 0 ? fmtPct(c.leads/totalLeadsOrigem*100) : '–'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Meta Ads geral ── */}
      <SectionLabel>Performance Meta Ads</SectionLabel>
      <KpiGrid cols={4}>
        <KpiCard label="Investimento"  value={fmtBRL(kpis?.invest)} highlight />
        <KpiCard label="Leads gerados" value={fmtNum(kpis?.leads)} sub={kpis?.cpl ? `CPL: ${fmtBRL(kpis.cpl)}` : undefined}/>
        <KpiCard label="Impressões"    value={fmtNum(kpis?.impres)}/>
        <KpiCard label="CTR médio"     value={fmtPct(kpis?.ctr, 2)}/>
      </KpiGrid>

      <Row>
        <Col flex={5}>
          <Card>
            <CardTitle>Funil completo</CardTitle>
            <div style={{marginTop:8}}>
              <FunnelBar label="Impressões" value={kpis?.impres??0} total={kpis?.impres??1} color="#E2E8F0"/>
              <FunnelBar label="Cliques"    value={kpis?.clicks??0} total={kpis?.impres??1} color="#93C5FD"/>
              <FunnelBar label="Leads WA"   value={kpis?.leads??0}  total={kpis?.impres??1} color="var(--blue-mid)"/>
            </div>
            <div style={{marginTop:12,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              <div style={{background:'#F8FAFC',borderRadius:8,padding:'8px 12px'}}><div style={{fontSize:10,color:'var(--text-hint)',textTransform:'uppercase',fontWeight:600}}>CTR</div><div style={{fontSize:16,fontWeight:700,fontFamily:'DM Mono',color:'var(--blue-dark)'}}>{fmtPct(kpis?.ctr,2)}</div></div>
              <div style={{background:'#F8FAFC',borderRadius:8,padding:'8px 12px'}}><div style={{fontSize:10,color:'var(--text-hint)',textTransform:'uppercase',fontWeight:600}}>CPL</div><div style={{fontSize:16,fontWeight:700,fontFamily:'DM Mono',color:'var(--blue-dark)'}}>{fmtBRL(kpis?.cpl)}</div></div>
            </div>
          </Card>
        </Col>
        <Col flex={7}>
          <Card>
            <CardTitle>Investimento × leads diários</CardTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData} margin={{top:0,right:0,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                <XAxis dataKey="data" tick={{fontSize:10,fill:'var(--text-muted)'}} interval={Math.max(0,Math.floor(dailyData.length/8)-1)}/>
                <YAxis yAxisId="left" tick={{fontSize:11,fill:'var(--text-muted)'}} tickFormatter={v=>`R$${v}`}/>
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:11,fill:'var(--text-muted)'}}/>
                <Tooltip contentStyle={{fontSize:12,borderRadius:8}}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Line yAxisId="left"  type="monotone" dataKey="invest" name="Investimento R$" stroke="var(--blue-dark)" dot={false} strokeWidth={2}/>
                <Line yAxisId="right" type="monotone" dataKey="leads"  name="Leads" stroke="var(--blue-light)" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <div style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:16, overflow:'hidden'}}>
        <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:13, fontWeight:600, color:'var(--text-primary)'}}>Ranking Meta Ads — leads gerados</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr>{['Campanha','Produtos vinculados','Leads Meta','Investimento','CPL','CTR'].map((h,i)=>(
              <th key={i} style={{...th, textAlign: i<2?'left':'right'}}>{h}</th>
            ))}</tr></thead>
            <tbody>{byCampanhaLegado.map((c,i)=>(
              <tr key={i} style={{borderBottom:i<byCampanhaLegado.length-1?'1px solid var(--border)':'none', background: i%2===0?'transparent':'#FAFBFC'}}>
                <td style={{...td,maxWidth:260}}><span style={{fontSize:12,fontWeight:500}}>{c.short}</span></td>
                <td style={td}>
                  {(campSubMap[c.nome]||[]).length>0
                    ? campSubMap[c.nome].map(s=><Badge key={s} value={s} type="info" />)
                    : <span style={{fontSize:11,color:'var(--text-hint)'}}>–</span>}
                </td>
                <td style={tdR}>{fmtNum(c.leads)}</td>
                <td style={tdR}>{fmtBRL(c.invest)}</td>
                <td style={tdR}>{c.cpl>0?fmtBRL(c.cpl):'–'}</td>
                <td style={{...td,textAlign:'right'}}>{fmtPct(c.ctr,2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
