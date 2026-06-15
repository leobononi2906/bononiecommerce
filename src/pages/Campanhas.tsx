import React, { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { useMetaAds, useCampanhaSubgrupos, useOrigemLeads, useSubgrupos } from '../hooks/useData'
import { KpiCard, Spinner, Card, CardTitle, SectionLabel, Badge } from '../components/ui'
import { PageHeader, KpiGrid, Row, Col, FunnelBar } from '../components/layout'
import { fmtBRL, fmtNum, fmtPct } from '../lib/fmt'
import type { Periodo } from '../types'

function shortCamp(name: string, maxLen = 38): string {
  const clean = name.replace(/\[[\d\/]+\]\s*/g,'').trim()
  return clean.length > maxLen ? clean.slice(0, maxLen)+'…' : clean
}

const COR: Record<string,string> = {
  'Ar Condicionado':'#1A3A8F','Gerador':'#0077CC',
  'Combo AC+Gerador':'#7C3AED','Geladeira':'#059669','Outros':'#94A3B8',
}

interface Props { periodo: Periodo }

export default function Campanhas({ periodo }: Props) {
  const { data: metaAds,  loading: lmeta   } = useMetaAds(periodo)
  const { data: campSub                    } = useCampanhaSubgrupos()
  const { data: origem,   loading: lorigem  } = useOrigemLeads(periodo)
  const { data: subgrupos                  } = useSubgrupos(periodo)

  // ── Faturamento por subgrupo no período ───────────────────
  const fatPorSubgrupo = useMemo(() => {
    const m = new Map<string, number>()
    subgrupos?.forEach(r => m.set(r.subgrupo, (m.get(r.subgrupo)||0) + r.faturamento))
    return m
  }, [subgrupos])

  const fatTotal = useMemo(() => {
    let t = 0; fatPorSubgrupo.forEach(v => t += v); return t
  }, [fatPorSubgrupo])

  // ── KPIs Meta Ads ─────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!metaAds) return null
    const invest = metaAds.reduce((s,r)=>s+r.investimento,0)
    const leads  = metaAds.reduce((s,r)=>s+(r.leads||0),0)
    const impres = metaAds.reduce((s,r)=>s+r.impressoes,0)
    const clicks = metaAds.reduce((s,r)=>s+r.cliques,0)
    const ctr    = impres>0 ? (clicks/impres)*100 : 0
    const cpl    = leads>0 ? invest/leads : 0
    const pctInvestFat = fatTotal>0 ? (invest/fatTotal)*100 : 0
    return { invest, leads, cpl, ctr, impres, clicks, pctInvestFat }
  }, [metaAds, fatTotal])

  // ── Cruzamento: Subgrupo × Investimento × Faturamento ────
  // Agrupa por subgrupo: soma investimento de todas campanhas vinculadas + faturamento do subgrupo no período
  const porSubgrupo = useMemo(() => {
    if (!campSub || !metaAds) return []

    // Investimento Meta por campanha no período
    const investPorCamp = new Map<string, number>()
    metaAds.forEach(r => investPorCamp.set(r.campanha, (investPorCamp.get(r.campanha)||0) + r.investimento))

    // Agrupa por subgrupo
    const map = new Map<string, { campanhas: string[]; investimento: number }>()
    campSub.forEach(cs => {
      const cur = map.get(cs.subgrupo_produto) || { campanhas:[], investimento:0 }
      if (!cur.campanhas.includes(cs.campanha)) {
        cur.campanhas.push(cs.campanha)
        cur.investimento += investPorCamp.get(cs.campanha) || 0
      }
      map.set(cs.subgrupo_produto, cur)
    })

    return [...map.entries()]
      .map(([subgrupo, d]) => {
        const faturamento = fatPorSubgrupo.get(subgrupo) || 0
        const pct = faturamento > 0 ? (d.investimento / faturamento) * 100 : 0
        return { subgrupo, investimento: d.investimento, faturamento, pct, campanhas: d.campanhas.length }
      })
      .filter(r => r.investimento > 0 || r.faturamento > 0)
      .sort((a,b) => b.faturamento - a.faturamento)
  }, [campSub, metaAds, fatPorSubgrupo])

  // ── Origem leads por produto ──────────────────────────────
  const porProduto = useMemo(() => {
    if (!origem) return []
    const map = new Map<string,{leads:number;investimento:number}>()
    origem.forEach(r => {
      const cur = map.get(r.produto)||{leads:0,investimento:0}
      cur.leads += r.leads; cur.investimento += r.investimento
      map.set(r.produto, cur)
    })
    return [...map.entries()]
      .map(([produto,d]) => ({ produto, leads:d.leads, investimento:d.investimento, cpl:d.leads>0?d.investimento/d.leads:0, cor:COR[produto]||'#94A3B8' }))
      .sort((a,b)=>b.leads-a.leads)
  }, [origem])

  // ── Origem leads por campanha ─────────────────────────────
  const campSubMap = useMemo(() => {
    const m: Record<string, string[]> = {}
    campSub?.forEach(cs => { if(!m[cs.campanha]) m[cs.campanha]=[]; m[cs.campanha].push(cs.subgrupo_produto) })
    return m
  }, [campSub])

  const porCampanha = useMemo(() => {
    if (!origem) return []
    const map = new Map<string,{produto:string;leads:number;investimento:number}>()
    origem.forEach(r => {
      const cur = map.get(r.campanha)||{produto:r.produto,leads:0,investimento:0}
      cur.leads += r.leads; cur.investimento += r.investimento
      map.set(r.campanha, cur)
    })
    return [...map.entries()]
      .map(([campanha,d]) => ({
        campanha, short: shortCamp(campanha), produto: d.produto,
        subgrupos: campSubMap[campanha] || [],
        leads: d.leads, investimento: d.investimento,
        cpl: d.leads>0 ? d.investimento/d.leads : 0,
      }))
      .sort((a,b)=>b.leads-a.leads).slice(0,15)
  }, [origem, campSubMap])

  // ── Gráfico diário ────────────────────────────────────────
  const dailyData = useMemo(() => {
    if (!metaAds) return []
    const map = new Map<string,{invest:number;leads:number}>()
    metaAds.forEach(r => {
      const cur = map.get(r.data)||{invest:0,leads:0}
      cur.invest+=r.investimento; cur.leads+=(r.leads||0)
      map.set(r.data,cur)
    })
    return [...map.entries()].sort().map(([data,d])=>({data:data.slice(5),...d}))
  }, [metaAds])

  const totalLeads  = porProduto.reduce((s,r)=>s+r.leads,0)
  const totalInvest = porProduto.reduce((s,r)=>s+r.investimento,0)

  if (lmeta) return <Spinner />

  const th: React.CSSProperties = { textAlign:'left', padding:'8px 12px', fontSize:11, color:'var(--text-hint)', fontWeight:600, borderBottom:'1px solid var(--border)', textTransform:'uppercase', whiteSpace:'nowrap' }
  const td: React.CSSProperties = { padding:'8px 12px', fontSize:13, borderBottom:'1px solid var(--border)' }
  const tdR: React.CSSProperties = { ...td, textAlign:'right', fontFamily:'DM Mono, monospace', fontWeight:600 }

  return (
    <div style={{ padding:'20px 24px', maxWidth:1400 }}>
      <PageHeader title="Campanhas" />

      {/* ── KPIs ── */}
      <SectionLabel>Performance geral</SectionLabel>
      <KpiGrid cols={5}>
        <KpiCard label="Investimento Meta"  value={fmtBRL(kpis?.invest)} highlight />
        <KpiCard label="Faturamento Ecomm." value={fmtBRL(fatTotal)} sub="excluindo marketplace" />
        <KpiCard label="% Invest / Fat"
          value={kpis?.pctInvestFat != null ? fmtPct(kpis.pctInvestFat,1) : '–'}
          sub={kpis?.pctInvestFat != null ? (kpis.pctInvestFat < 15 ? '✅ saudável' : '⚠️ alto') : undefined} />
        <KpiCard label="Leads Meta"  value={fmtNum(kpis?.leads)} sub={kpis?.cpl ? `CPL: ${fmtBRL(kpis.cpl)}` : undefined} />
        <KpiCard label="CTR médio"   value={fmtPct(kpis?.ctr,2)} />
      </KpiGrid>

      {/* ── Cruzamento Subgrupo × Investimento × Faturamento ── */}
      <SectionLabel>Investimento × Faturamento por subgrupo</SectionLabel>
      {porSubgrupo.length === 0 ? (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:24, marginBottom:20, textAlign:'center', color:'var(--text-hint)', fontSize:13 }}>
          Vincule campanhas a subgrupos em <strong>Configurações</strong> para ver o cruzamento aqui.
        </div>
      ) : (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:20, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>
              <th style={th}>Subgrupo</th>
              <th style={{...th, textAlign:'right'}}>Total investido</th>
              <th style={{...th, textAlign:'right'}}>Total faturado</th>
              <th style={{...th, textAlign:'right'}}>% Invest/Fat</th>
              <th style={{...th, textAlign:'right'}}>ROAS</th>
            </tr></thead>
            <tbody>
              {porSubgrupo.map((r,i) => {
                const roas = r.investimento > 0 ? r.faturamento / r.investimento : 0
                const pctOk = r.pct < 30
                const roasOk = roas >= 3
                return (
                  <tr key={i} style={{ background:i%2===0?'transparent':'#FAFBFC', borderBottom:'1px solid var(--border)' }}>
                    <td style={{...td, fontWeight:600}}>
                      <Badge value={r.subgrupo} type="info"/>
                      <span style={{ fontSize:11, color:'var(--text-hint)', marginLeft:8 }}>{r.campanhas} campanha(s)</span>
                    </td>
                    <td style={tdR}>{fmtBRL(r.investimento)}</td>
                    <td style={{...tdR, fontSize:15, color:'var(--blue-dark)'}}>{fmtBRL(r.faturamento)}</td>
                    <td style={{...tdR, color: r.pct===0?'var(--text-hint)':pctOk?'var(--green)':'var(--amber)'}}>
                      {r.pct > 0 ? fmtPct(r.pct,1) : '–'}
                    </td>
                    <td style={{...tdR, color: roas===0?'var(--text-hint)':roasOk?'var(--green)':'var(--red)'}}>
                      {roas > 0 ? `${roas.toFixed(1)}x` : '–'}
                    </td>
                  </tr>
                )
              })}
              {/* Totais */}
              <tr style={{ background:'#EFF6FF', borderTop:'2px solid var(--border)' }}>
                <td style={{...td, fontWeight:700, color:'var(--blue-dark)'}}>Total</td>
                <td style={{...tdR, fontWeight:700}}>{fmtBRL(porSubgrupo.reduce((s,r)=>s+r.investimento,0))}</td>
                <td style={{...tdR, fontWeight:700, fontSize:15, color:'var(--blue-dark)'}}>{fmtBRL(porSubgrupo.reduce((s,r)=>s+r.faturamento,0))}</td>
                <td style={{...tdR, fontWeight:700, color:'var(--text-primary)'}}>
                  {(() => {
                    const ti = porSubgrupo.reduce((s,r)=>s+r.investimento,0)
                    const tf = porSubgrupo.reduce((s,r)=>s+r.faturamento,0)
                    return tf>0 ? fmtPct((ti/tf)*100,1) : '–'
                  })()}
                </td>
                <td style={{...tdR, fontWeight:700, color:'var(--green)'}}>
                  {(() => {
                    const ti = porSubgrupo.reduce((s,r)=>s+r.investimento,0)
                    const tf = porSubgrupo.reduce((s,r)=>s+r.faturamento,0)
                    return ti>0 ? `${(tf/ti).toFixed(1)}x` : '–'
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Origem dos leads por produto ── */}
      <SectionLabel>Origem dos leads — atribuição TinTim</SectionLabel>
      {lorigem ? <Spinner /> : (
        <>
          <KpiGrid cols={porProduto.length||4}>
            {porProduto.map(p => (
              <div key={p.produto} style={{ background:'var(--surface)', border:`2px solid ${p.cor}22`, borderLeft:`4px solid ${p.cor}`, borderRadius:'var(--radius-lg)', padding:'14px 16px' }}>
                <div style={{ fontSize:11, fontWeight:600, color:p.cor, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:6 }}>{p.produto}</div>
                <div style={{ fontSize:24, fontWeight:700, color:'var(--text-primary)', fontFamily:'DM Mono, monospace' }}>
                  {fmtNum(p.leads)}<span style={{ fontSize:13, fontWeight:400, color:'var(--text-muted)', marginLeft:4 }}>leads</span>
                </div>
                <div style={{ display:'flex', gap:12, marginTop:8 }}>
                  <div><div style={{ fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase' }}>Invest.</div><div style={{ fontSize:13, fontWeight:600 }}>{fmtBRL(p.investimento)}</div></div>
                  <div><div style={{ fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase' }}>CPL</div><div style={{ fontSize:13, fontWeight:600, color:p.cor }}>{p.cpl>0?fmtBRL(p.cpl):'–'}</div></div>
                  <div><div style={{ fontSize:10, color:'var(--text-hint)', fontWeight:600, textTransform:'uppercase' }}>Share</div><div style={{ fontSize:13, fontWeight:600 }}>{totalLeads>0?fmtPct(p.leads/totalLeads*100):'–'}</div></div>
                </div>
                <div style={{ marginTop:10, height:4, background:'#F1F5F9', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:p.cor, borderRadius:2, width:totalLeads>0?`${Math.min(p.leads/totalLeads*100,100)}%`:'0%', transition:'width 0.5s ease' }}/>
                </div>
              </div>
            ))}
          </KpiGrid>

          {/* Ranking campanhas com subgrupo */}
          {porCampanha.length > 0 && (
            <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', marginBottom:20, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600 }}>Ranking de campanhas — leads atribuídos</span>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>{fmtNum(totalLeads)} leads · {fmtBRL(totalInvest)}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>
                  <th style={th}>Campanha</th>
                  <th style={th}>Subgrupo vinculado</th>
                  <th style={{...th,textAlign:'right'}}>Leads</th>
                  <th style={{...th,textAlign:'right'}}>Invest.</th>
                  <th style={{...th,textAlign:'right'}}>CPL</th>
                  <th style={{...th,textAlign:'right'}}>Share</th>
                </tr></thead>
                <tbody>
                  {porCampanha.map((c,i) => (
                    <tr key={i} style={{ background:i%2===0?'transparent':'#FAFBFC' }}>
                      <td style={{...td,maxWidth:260}}><span style={{ fontSize:12, fontWeight:500 }}>{c.short}</span></td>
                      <td style={td}>
                        {c.subgrupos.length > 0
                          ? c.subgrupos.map(s => <Badge key={s} value={s} type="info"/>)
                          : <span style={{ fontSize:11, color:'var(--text-hint)', fontStyle:'italic' }}>Não vinculado</span>}
                      </td>
                      <td style={tdR}>{fmtNum(c.leads)}</td>
                      <td style={tdR}>{c.investimento>0?fmtBRL(c.investimento):'–'}</td>
                      <td style={tdR}>{c.cpl>0?fmtBRL(c.cpl):'–'}</td>
                      <td style={tdR}>
                        <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end' }}>
                          <div style={{ width:48, height:4, background:'#F1F5F9', borderRadius:2, overflow:'hidden' }}>
                            <div style={{ height:'100%', background:'var(--blue-mid)', borderRadius:2, width:totalLeads>0?`${Math.min(c.leads/totalLeads*100,100)}%`:'0%' }}/>
                          </div>
                          <span style={{ fontSize:12, minWidth:32, textAlign:'right' }}>{totalLeads>0?fmtPct(c.leads/totalLeads*100):'–'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Meta Ads: funil + gráfico ── */}
      <SectionLabel>Performance Meta Ads</SectionLabel>
      <Row>
        <Col flex={5}>
          <Card>
            <CardTitle>Funil completo</CardTitle>
            <div style={{ marginTop:8 }}>
              <FunnelBar label="Impressões" value={kpis?.impres??0} total={kpis?.impres??1} color="#E2E8F0"/>
              <FunnelBar label="Cliques"    value={kpis?.clicks??0} total={kpis?.impres??1} color="#93C5FD"/>
              <FunnelBar label="Leads WA"   value={kpis?.leads??0}  total={kpis?.impres??1} color="var(--blue-mid)"/>
            </div>
            <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'#F8FAFC', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'var(--text-hint)', textTransform:'uppercase', fontWeight:600 }}>CTR</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'DM Mono', color:'var(--blue-dark)' }}>{fmtPct(kpis?.ctr,2)}</div>
              </div>
              <div style={{ background:'#F8FAFC', borderRadius:8, padding:'8px 12px' }}>
                <div style={{ fontSize:10, color:'var(--text-hint)', textTransform:'uppercase', fontWeight:600 }}>CPL</div>
                <div style={{ fontSize:16, fontWeight:700, fontFamily:'DM Mono', color:'var(--blue-dark)' }}>{fmtBRL(kpis?.cpl)}</div>
              </div>
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
                <Line yAxisId="right" type="monotone" dataKey="leads"  name="Leads" stroke="#00AAEE" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
