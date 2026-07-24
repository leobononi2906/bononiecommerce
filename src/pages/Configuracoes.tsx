import React, { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useUmblerVendedores, useCampanhaSubgrupos, useLeadsUmblerIds, useSubgruposERP, useMetaAdsAtivos } from '../hooks/useData'
import { Card, CardTitle, SectionLabel, Badge, Spinner } from '../components/ui'
import ThresholdConfig from '../components/campaigns/ThresholdConfig'
import { Plus, Trash2, Save, UserPlus } from 'lucide-react'
import type { EcomUmblerVendedor, Periodo } from '../types'
import { usePeriodo } from '../components/layout/AppShell'

const INPUT: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  fontSize: 12, fontFamily: 'DM Sans, sans-serif', color: 'var(--text-primary)',
  background: 'var(--surface)', outline: 'none', width: '100%',
}
const BTN = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 'var(--radius)',
  border: `1px solid ${color}`, background: bg,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  color, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
})
const th: React.CSSProperties = {
  textAlign: 'left', padding: '5px 8px', fontSize: 11,
  color: 'var(--text-hint)', fontWeight: 600,
  borderBottom: '1px solid var(--border)', textTransform: 'uppercase', whiteSpace: 'nowrap',
}
const td: React.CSSProperties = { padding: '7px 8px', fontSize: 12 }

export default function Configuracoes() {
  const { periodo } = usePeriodo()
  const { data: umblerVend,  loading: lv   } = useUmblerVendedores()
  const { data: campSub,     loading: lcs  } = useCampanhaSubgrupos()
  const { data: leadsIds,    loading: lids } = useLeadsUmblerIds(periodo)
  const { data: subgruposERP               } = useSubgruposERP()
  const { data: campanhasAtivas            } = useMetaAdsAtivos()

  // ── mapa de IDs já vinculados ────────────────────────────
  const vinculadosMap = useMemo(() => {
    const m = new Map<string, EcomUmblerVendedor>()
    ;(umblerVend||[]).forEach(v => m.set(v.id_membro_umbler, v))
    return m
  }, [umblerVend])

  // ── campanhas já vinculadas (some do select) ─────────────
  const campanhasJaVinculadas = useMemo(
    () => new Set((campSub||[]).map(cs => cs.campanha)),
    [campSub]
  )

  // Apenas campanhas ativas nos últimos 30 dias e ainda não vinculadas
  const campanhasDisponiveis = useMemo(() => {
    return (campanhasAtivas||[]).filter(c => !campanhasJaVinculadas.has(c))
  }, [campanhasAtivas, campanhasJaVinculadas])

  // ── form vendedor ────────────────────────────────────────
  const [vendForm, setVendForm] = useState({ id_membro_umbler:'', nome_vendedor_erp:'', id_vendedor_erp:'', nome_vendedor_erp_completo:'' })
  const [vendMsg, setVendMsg]   = useState('')
  const [vendSaving, setVendSaving] = useState(false)

  function preencherForm(id_umbler: string) {
    setVendForm(f => ({ ...f, id_membro_umbler: id_umbler }))
    document.getElementById('form-vendedor')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function saveVendedor() {
    if (!vendForm.id_membro_umbler || !vendForm.nome_vendedor_erp || !vendForm.id_vendedor_erp) {
      setVendMsg('Preencha todos os campos obrigatórios.'); return
    }
    setVendSaving(true)
    const { error } = await supabase.from('ecom_umbler_vendedor').upsert({
      id_membro_umbler: vendForm.id_membro_umbler.trim(),
      nome_vendedor_erp: vendForm.nome_vendedor_erp.trim().toUpperCase(),
      nome_vendedor_erp_completo: vendForm.nome_vendedor_erp_completo.trim() || null,
      id_vendedor_erp: parseInt(vendForm.id_vendedor_erp),
      ativo: true, criado_em: new Date().toISOString(),
    })
    setVendSaving(false)
    if (error) setVendMsg('Erro: ' + error.message)
    else {
      setVendMsg('Salvo!')
      setVendForm({ id_membro_umbler:'', nome_vendedor_erp:'', id_vendedor_erp:'', nome_vendedor_erp_completo:'' })
      setTimeout(() => window.location.reload(), 600)
    }
  }

  async function toggleVendedor(id: string, ativo: boolean) {
    await supabase.from('ecom_umbler_vendedor').update({ ativo: !ativo }).eq('id_membro_umbler', id)
    window.location.reload()
  }
  async function toggleInterno(id: string, interno: boolean) {
    await supabase.from('ecom_umbler_vendedor').update({ interno: !interno }).eq('id_membro_umbler', id)
    window.location.reload()
  }
  async function deleteVendedor(id: string) {
    if (!confirm('Remover este vínculo?')) return
    await supabase.from('ecom_umbler_vendedor').delete().eq('id_membro_umbler', id)
    window.location.reload()
  }

  // ── form campanha × subgrupo ─────────────────────────────
  const [csForm, setCsForm]     = useState({ campanha:'', subgrupo_produto:'' })
  const [csMsg, setCsMsg]       = useState('')
  const [csSaving, setCsSaving] = useState(false)

  async function saveCampanhaSubgrupo() {
    if (!csForm.campanha || !csForm.subgrupo_produto) {
      setCsMsg('Selecione campanha e subgrupo.'); return
    }
    setCsSaving(true)
    const { error } = await supabase.from('ecom_campanha_subgrupo').insert({
      campanha: csForm.campanha,
      subgrupo_produto: csForm.subgrupo_produto,
    })
    setCsSaving(false)
    if (error) setCsMsg('Erro: ' + error.message)
    else {
      setCsMsg('Vínculo salvo!')
      setCsForm({ campanha:'', subgrupo_produto:'' })
      setTimeout(() => window.location.reload(), 600)
    }
  }
  async function deleteCampanhaSubgrupo(id: number) {
    if (!confirm('Remover?')) return
    await supabase.from('ecom_campanha_subgrupo').delete().eq('id', id)
    window.location.reload()
  }

  // ── metas ────────────────────────────────────────────────
  const [metas, setMetas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stonni_metas')||'{}') } catch { return {} }
  })
  const [metasMsg, setMetasMsg] = useState('')
  function saveMetas() {
    localStorage.setItem('stonni_metas', JSON.stringify(metas))
    setMetasMsg('Salvas!'); setTimeout(() => setMetasMsg(''), 2000)
  }

  const [periodoDefault, setPeriodoDefault] = useState(
    () => localStorage.getItem('stonni_periodo_default')||'mes_atual'
  )
  function savePeriodo(v: string) {
    setPeriodoDefault(v); localStorage.setItem('stonni_periodo_default', v)
  }
  const PERIODOS = [
    { value:'mes_atual', label:'Mês atual' },
    { value:'mes_anterior', label:'Mês anterior' },
    { value:'3_meses', label:'Últimos 3 meses' },
    { value:'6_meses', label:'Últimos 6 meses' },
  ]

  return (
    <div style={{ padding:'24px 28px', maxWidth:1200 }}>
      <h1 style={{ fontSize:18, fontWeight:600, marginBottom:24 }}>Configurações</h1>

      {/* ══════════ VENDEDORES ══════════ */}
      <SectionLabel>Vendedores — vínculo Umbler ↔ ERP</SectionLabel>

      <Card style={{ marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <CardTitle>IDs Umbler ativos no período</CardTitle>
          <span style={{ fontSize:11, color:'var(--text-hint)' }}>
            {leadsIds ? `${leadsIds.length} IDs detectados` : ''}
          </span>
        </div>
        {lids || lv ? <Spinner /> : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>
                  {['ID Umbler','Nome detectado','Leads','Último lead','Vínculo ERP',''].map((h,i) => (
                    <th key={i} style={{...th, textAlign:i>=2?'right':'left'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(leadsIds||[]).map((item, i) => {
                  const vinculo = vinculadosMap.get(item.id_umbler)
                  const semVinculo = !vinculo
                  return (
                    <tr key={i} style={{ background:semVinculo?'#FFFBEB':'transparent', borderBottom:'1px solid var(--border)' }}>
                      <td style={{...td, fontFamily:'DM Mono', fontSize:11, color:'var(--text-muted)'}}>{item.id_umbler}</td>
                      <td style={{...td, fontWeight:vinculo?500:400, color:semVinculo?'var(--amber)':'var(--text-primary)'}}>
                        {vinculo ? vinculo.nome_vendedor_erp : (item.nome_umbler===item.id_umbler?'–':item.nome_umbler)}
                      </td>
                      <td style={{...td, textAlign:'right', fontFamily:'DM Mono', fontWeight:600}}>{item.leads_mes}</td>
                      <td style={{...td, textAlign:'right', color:'var(--text-muted)', fontSize:11}}>{item.ultimo_lead}</td>
                      <td style={{...td, textAlign:'right'}}>
                        {vinculo
                          ? <><Badge value={`ERP ${vinculo.id_vendedor_erp}`} type="ok" />
                              <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:4}}>{vinculo.nome_vendedor_erp}</span></>
                          : <Badge value="Sem vínculo" type="warn" />
                        }
                      </td>
                      <td style={{...td, textAlign:'right'}}>
                        {semVinculo && (
                          <button style={BTN('var(--blue-dark)','#EFF6FF')} onClick={() => preencherForm(item.id_umbler)}>
                            <UserPlus size={12}/> Vincular
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div id="form-vendedor"><Card style={{ marginBottom:20 }}>
        <CardTitle>Cadastrar / atualizar vínculo</CardTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:10, marginBottom:10 }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>ID Membro Umbler *</label>
            <input style={INPUT} placeholder="Ex: aW-xxzMMYu2X_QhY" value={vendForm.id_membro_umbler}
              onChange={e => setVendForm(f=>({...f,id_membro_umbler:e.target.value}))}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>Nome (display) *</label>
            <input style={INPUT} placeholder="Ex: FELIPE" value={vendForm.nome_vendedor_erp}
              onChange={e => setVendForm(f=>({...f,nome_vendedor_erp:e.target.value}))}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>ID Vendedor ERP *</label>
            <input style={INPUT} placeholder="Ex: 55351" type="number" value={vendForm.id_vendedor_erp}
              onChange={e => setVendForm(f=>({...f,id_vendedor_erp:e.target.value}))}/>
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>Nome completo ERP</label>
            <input style={INPUT} placeholder="Nome completo (opcional)" value={vendForm.nome_vendedor_erp_completo}
              onChange={e => setVendForm(f=>({...f,nome_vendedor_erp_completo:e.target.value}))}/>
          </div>
        </div>
        {vendMsg && <div style={{ fontSize:12, color:vendMsg.includes('Erro')?'var(--red)':'var(--green)', marginBottom:8 }}>{vendMsg}</div>}
        <button style={BTN('var(--blue-dark)','#EFF6FF')} onClick={saveVendedor} disabled={vendSaving}>
          <Plus size={13}/>{vendSaving?'Salvando…':'Salvar vínculo'}
        </button>
      </Card></div>

      <Card style={{ marginBottom:28 }}>
        <CardTitle>Vínculos cadastrados</CardTitle>
        {lv ? <Spinner /> : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['ID Umbler','Nome ERP','ID ERP','Nome completo','Status','Interno','Ações'].map((h,i)=>(
                <th key={i} style={th}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(umblerVend||[]).map((v,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid var(--border)', opacity:v.ativo?1:0.5 }}>
                  <td style={{...td,fontFamily:'DM Mono',fontSize:11,color:'var(--text-muted)'}}>{v.id_membro_umbler}</td>
                  <td style={{...td,fontWeight:500}}>{v.nome_vendedor_erp}</td>
                  <td style={{...td,fontFamily:'DM Mono'}}>{v.id_vendedor_erp}</td>
                  <td style={{...td,color:'var(--text-muted)'}}>{v.nome_vendedor_erp_completo||'–'}</td>
                  <td style={td}><Badge value={v.ativo?'Ativo':'Inativo'} type={v.ativo?'ok':'neutral'}/></td>
                  <td style={td}>
                    <button
                      onClick={()=>toggleInterno(v.id_membro_umbler, (v as any).interno||false)}
                      title={(v as any).interno ? 'Clique para marcar como vendedor' : 'Clique para marcar como interno'}
                      style={{ ...BTN((v as any).interno?'var(--amber)':'var(--text-hint)', (v as any).interno?'var(--amber-bg)':'#F1F5F9'), fontSize:11 }}>
                      {(v as any).interno ? '🔧 Interno' : '–'}
                    </button>
                  </td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button style={BTN(v.ativo?'var(--amber)':'var(--green)',v.ativo?'var(--amber-bg)':'var(--green-bg)')}
                        onClick={()=>toggleVendedor(v.id_membro_umbler,v.ativo)}>
                        {v.ativo?'Desativar':'Ativar'}
                      </button>
                      <button style={BTN('var(--red)','var(--red-bg)')} onClick={()=>deleteVendedor(v.id_membro_umbler)}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ══════════ CAMPANHA × SUBGRUPO ══════════ */}
      <SectionLabel>Campanhas × Subgrupos de produto</SectionLabel>

      <Card style={{ marginBottom:16 }}>
        <CardTitle>Vincular campanha a subgrupo</CardTitle>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12, lineHeight:1.6 }}>
          Associe cada campanha ativa ao subgrupo de produto do ERP. Isso cruza investimento com faturamento na aba Campanhas.
          Campanhas já vinculadas somem automaticamente do select.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'flex-end' }}>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>
              Campanha * <span style={{ fontWeight:400, color:'var(--text-hint)' }}>(ativas nos últimos 30 dias, sem vínculo)</span>
            </label>
            <select style={INPUT} value={csForm.campanha} onChange={e=>setCsForm(f=>({...f,campanha:e.target.value}))}>
              <option value="">
                {campanhasDisponiveis.length === 0
                  ? 'Todas as campanhas ativas já estão vinculadas ✅'
                  : `Selecione (${campanhasDisponiveis.length} disponíveis)…`}
              </option>
              {campanhasDisponiveis.map(c => (
                <option key={c} value={c}>{c.length>70?c.slice(0,70)+'…':c}</option>
              ))}
            </select>
            {campanhasJaVinculadas.size > 0 && (
              <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>
                ✅ {campanhasJaVinculadas.size} campanha(s) já vinculada(s) e ocultadas do select
              </div>
            )}
          </div>
          <div>
            <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>Subgrupo de produto *</label>
            <select style={INPUT} value={csForm.subgrupo_produto} onChange={e=>setCsForm(f=>({...f,subgrupo_produto:e.target.value}))}>
              <option value="">Selecione o subgrupo…</option>
              {(subgruposERP||[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <button style={BTN('var(--blue-dark)','#EFF6FF')} onClick={saveCampanhaSubgrupo} disabled={csSaving||!csForm.campanha||!csForm.subgrupo_produto}>
              <Plus size={13}/>{csSaving?'Salvando…':'Vincular'}
            </button>
          </div>
        </div>
        {csMsg && <div style={{ fontSize:12, color:csMsg.includes('Erro')?'var(--red)':'var(--green)', marginTop:8 }}>{csMsg}</div>}
      </Card>

      <Card style={{ marginBottom:28 }}>
        <CardTitle>Vínculos campanha × subgrupo cadastrados</CardTitle>
        {lcs ? <Spinner /> : campSub?.length === 0 ? (
          <p style={{ fontSize:12, color:'var(--text-hint)', padding:'12px 0' }}>Nenhum vínculo cadastrado ainda.</p>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>{['Campanha','Subgrupo','Criado em',''].map((h,i)=>(
                <th key={i} style={{...th,textAlign:i<2?'left':'right'}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {(campSub||[]).map((cs,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{...td,maxWidth:380}}>
                    <span style={{ fontSize:11 }}>{cs.campanha.length>65?cs.campanha.slice(0,65)+'…':cs.campanha}</span>
                  </td>
                  <td style={td}><Badge value={cs.subgrupo_produto} type="info"/></td>
                  <td style={{...td,textAlign:'right',color:'var(--text-hint)',fontSize:11}}>
                    {new Date(cs.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{...td,textAlign:'right'}}>
                    <button style={BTN('var(--red)','var(--red-bg)')} onClick={()=>deleteCampanhaSubgrupo(cs.id)}>
                      <Trash2 size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ══════════ METAS ══════════ */}
      <SectionLabel>Metas do dashboard</SectionLabel>
      <Card style={{ marginBottom:24 }}>
        <CardTitle>Defina seus objetivos</CardTitle>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:12 }}>
          {[
            {key:'fat_mensal',label:'Meta faturamento mensal (R$)',placeholder:'500000'},
            {key:'roas_meta',label:'Meta de ROAS',placeholder:'40'},
            {key:'conversao_meta',label:'Meta de conversão (%)',placeholder:'25'},
            {key:'ticket_meta',label:'Meta ticket médio (R$)',placeholder:'5000'},
            {key:'cpl_meta',label:'Meta CPL máximo (R$)',placeholder:'20'},
            {key:'tempo_resposta_meta',label:'Meta tempo resposta (min)',placeholder:'15'},
          ].map(({key,label,placeholder})=>(
            <div key={key}>
              <label style={{ fontSize:11, color:'var(--text-hint)', display:'block', marginBottom:4 }}>{label}</label>
              <input style={INPUT} type="number" placeholder={placeholder} value={metas[key]||''}
                onChange={e=>setMetas((m:any)=>({...m,[key]:e.target.value}))}/>
            </div>
          ))}
        </div>
        {metasMsg && <div style={{ fontSize:12, color:'var(--green)', marginBottom:8 }}>{metasMsg}</div>}
        <button style={BTN('var(--blue-dark)','#EFF6FF')} onClick={saveMetas}>
          <Save size={13}/> Salvar metas
        </button>
        <span style={{ fontSize:11, color:'var(--text-hint)', marginLeft:8 }}>Salvo localmente no navegador</span>
      </Card>

      {/* ══════════ PERÍODO PADRÃO ══════════ */}
      <SectionLabel>Período padrão ao abrir</SectionLabel>
      <Card>
        <CardTitle>Filtro inicial</CardTitle>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {PERIODOS.map(p=>(
            <button key={p.value} onClick={()=>savePeriodo(p.value)} style={{
              padding:'8px 16px', borderRadius:'var(--radius)',
              border:`1px solid ${periodoDefault===p.value?'var(--blue-dark)':'var(--border)'}`,
              background:periodoDefault===p.value?'var(--blue-dark)':'transparent',
              color:periodoDefault===p.value?'#fff':'var(--text-muted)',
              fontSize:12, fontWeight:500, cursor:'pointer',
              fontFamily:'DM Sans, sans-serif', transition:'all 0.15s',
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'var(--text-hint)', marginTop:8 }}>
          Atual: <strong>{PERIODOS.find(p=>p.value===periodoDefault)?.label}</strong>
        </div>
      </Card>

      {/* ══════════ LIMIARES DE CAMPANHAS ══════════ */}
      <SectionLabel>Limiares de campanhas</SectionLabel>
      <Card>
        <CardTitle>Configurar semáforo e veredictos</CardTitle>
        <p style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12, lineHeight:1.6 }}>
          Defina os limiares que determinam os veredictos (ESCALAR, MANTER, MONITORAR, PAUSAR) na aba Campanhas.
        </p>
        <ThresholdConfig />
      </Card>
    </div>
  )
}
