import React, { useEffect, useState, useCallback } from 'react'
import { Settings, Plus, RefreshCw, AlertTriangle, CheckCircle, XCircle, Package, Pencil, Save, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fmtNum } from '../lib/fmt'
import type { Periodo } from '../types'

type Conta = { id: number; nome: string; id_vendedor_erp: number; dias_reposicao: number; ativo: boolean }
type PainelItem = {
  id: number; id_conta: number; conta: string; id_vendedor_erp: number; dias_reposicao: number
  referencia: string; nome_produto: string; id_anuncio_ml: string | null
  estoque_atual: number; estoque_minimo: number; estoque_inicial: number
  media_diaria_30d: number; estoque_necessario_reposicao: number
  dias_restantes: number | null; alerta: 'OK' | 'ATENCAO' | 'CRITICO' | 'ZERADO'; atualizado_em: string
}
type NovoItem = { referencia: string; nome_produto: string; id_anuncio_ml: string; estoque_inicial: string; estoque_minimo: string }

const C = {
  blueDark:'var(--blue-dark)',blueMid:'var(--blue-mid)',surface:'var(--surface)',border:'var(--border)',
  txt:'var(--text-primary)',muted:'var(--text-muted)',hint:'var(--text-hint)',
  green:'var(--green)',greenBg:'var(--green-bg)',red:'var(--red)',redBg:'var(--red-bg)',
  amber:'var(--amber)',amberBg:'var(--amber-bg)',radius:'var(--radius)',radiusLg:'var(--radius-lg)',
}
const font = { fontFamily:'DM Sans, sans-serif' }
const ALERTA: Record<string,{bg:string;fg:string;icon:React.ReactNode;label:string}> = {
  OK:      {bg:'var(--green-bg)', fg:'var(--green)',  icon:<CheckCircle size={13}/>, label:'OK'},
  ATENCAO: {bg:'var(--amber-bg)', fg:'var(--amber)',  icon:<AlertTriangle size={13}/>, label:'Atenção'},
  CRITICO: {bg:'var(--red-bg)',   fg:'var(--red)',    icon:<XCircle size={13}/>, label:'Crítico'},
  ZERADO:  {bg:'#1c1c1c',        fg:'#fff',          icon:<XCircle size={13}/>, label:'Zerado'},
}

export default function Marketplace(_props:{periodo?:Periodo}) {
  const [contas,setContas]     = useState<Conta[]>([])
  const [painel,setPainel]     = useState<PainelItem[]>([])
  const [loading,setLoading]   = useState(false)
  const [erro,setErro]         = useState<string|null>(null)
  const [aba,setAba]           = useState<number|null>(null)
  const [editConta,setEditConta] = useState<number|null>(null)
  const [editVal,setEditVal]   = useState<Partial<Conta>>({})
  const [showNovo,setShowNovo] = useState(false)
  const [novoContaId,setNovoContaId] = useState<number|null>(null)
  const [novoItem,setNovoItem] = useState<NovoItem>({referencia:'',nome_produto:'',id_anuncio_ml:'',estoque_inicial:'',estoque_minimo:'5'})
  const [ajustando,setAjustando] = useState<number|null>(null)
  const [ajusteVal,setAjusteVal] = useState('')

  const carregar = useCallback(async()=>{
    setLoading(true);setErro(null)
    try {
      const [{data:c},{data:p}] = await Promise.all([
        supabase.from('ml_contas').select('*').eq('ativo',true).order('id'),
        supabase.from('ml_full_painel').select('*').order('alerta').order('dias_restantes',{ascending:true,nullsFirst:false}),
      ])
      if(c){setContas(c);if(!aba&&c.length)setAba(c[0].id)}
      if(p)setPainel(p)
    }catch(e:any){setErro(e?.message??String(e))}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{carregar()},[carregar])

  const itens=(id:number)=>painel.filter(p=>p.id_conta===id)
  const res=(id:number)=>{const it=itens(id);return{total:it.length,ok:it.filter(i=>i.alerta==='OK').length,atencao:it.filter(i=>i.alerta==='ATENCAO').length,critico:it.filter(i=>i.alerta==='CRITICO'||i.alerta==='ZERADO').length}}

  async function salvarConta(id:number){
    const{error}=await supabase.from('ml_contas').update(editVal).eq('id',id)
    if(error){setErro(error.message);return}
    setEditConta(null);carregar()
  }
  async function adicionarProduto(){
    if(!novoContaId||!novoItem.referencia)return
    const qtd=parseInt(novoItem.estoque_inicial)||0
    const{error}=await supabase.from('ml_full_estoque').upsert({
      id_conta:novoContaId,referencia:novoItem.referencia.trim().replace(/^0+/,''),
      nome_produto:novoItem.nome_produto,id_anuncio_ml:novoItem.id_anuncio_ml||null,
      estoque_inicial:qtd,estoque_atual:qtd,estoque_minimo:parseInt(novoItem.estoque_minimo)||5,
      atualizado_em:new Date().toISOString(),
    },{onConflict:'id_conta,referencia'})
    if(error){setErro(error.message);return}
    if(qtd>0)await supabase.from('ml_full_movimentacoes').insert({id_conta:novoContaId,referencia:novoItem.referencia.trim().replace(/^0+/,''),tipo:'entrada_manual',quantidade:qtd,observacao:'Lançamento inicial'})
    setShowNovo(false);setNovoItem({referencia:'',nome_produto:'',id_anuncio_ml:'',estoque_inicial:'',estoque_minimo:'5'});carregar()
  }
  async function ajustar(it:PainelItem){
    const d=parseInt(ajusteVal);if(isNaN(d)||d===0){setAjustando(null);return}
    const novo=Math.max(0,it.estoque_atual+d)
    await supabase.from('ml_full_estoque').update({estoque_atual:novo,atualizado_em:new Date().toISOString()}).eq('id',it.id)
    await supabase.from('ml_full_movimentacoes').insert({id_conta:it.id_conta,referencia:it.referencia,tipo:'ajuste',quantidade:d,observacao:'Ajuste manual'})
    setAjustando(null);setAjusteVal('');carregar()
  }

  const th:React.CSSProperties={textAlign:'left',padding:'10px 12px',background:C.blueDark,color:'#fff',fontSize:11,fontWeight:600,textTransform:'uppercase',letterSpacing:'.4px',position:'sticky',top:0,whiteSpace:'nowrap',...font}
  const td:React.CSSProperties={padding:'9px 12px',borderBottom:`1px solid ${C.border}`,fontSize:13,...font}
  const tdR:React.CSSProperties={...td,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600}
  const inp:React.CSSProperties={border:`1px solid ${C.border}`,borderRadius:7,padding:'6px 10px',fontSize:13,width:'100%',...font}

  return(
    <div style={{padding:24,...font}}>
      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:C.blueDark}}>Gestão ML Full</div>
          <div style={{fontSize:12.5,color:C.muted,marginTop:3}}>Estoque Full por conta · alertas automáticos de ruptura</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{setShowNovo(true);setNovoContaId(aba)}} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',...font}}>
            <Plus size={14}/> Adicionar Produto
          </button>
          <button onClick={carregar} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:C.radius,border:`1px solid ${C.border}`,background:C.surface,color:C.txt,fontSize:13,cursor:'pointer',...font}}>
            <RefreshCw size={14}/> Atualizar
          </button>
        </div>
      </div>

      {erro&&<div style={{background:C.redBg,color:C.red,border:`1px solid #F5C2C2`,borderRadius:C.radius,padding:'10px 14px',marginBottom:14,fontSize:13}}>{erro}</div>}

      {/* ABAS */}
      <div style={{display:'flex',gap:0,borderBottom:`2px solid ${C.border}`,marginBottom:20}}>
        {contas.map(c=>{const r=res(c.id);const at=aba===c.id;return(
          <button key={c.id} onClick={()=>setAba(c.id)} style={{padding:'10px 20px',border:'none',background:'transparent',cursor:'pointer',fontWeight:at?700:500,fontSize:14,color:at?C.blueDark:C.muted,borderBottom:at?`2px solid ${C.blueDark}`:'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',gap:8,...font}}>
            {c.nome}
            {r.critico>0&&<span style={{background:C.red,color:'#fff',fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20}}>{r.critico}</span>}
            {r.atencao>0&&<span style={{background:C.amber,color:'#fff',fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:20}}>{r.atencao}</span>}
          </button>
        )})}
        <button onClick={()=>setAba(-1)} style={{padding:'10px 16px',border:'none',background:'transparent',cursor:'pointer',color:aba===-1?C.blueDark:C.muted,fontWeight:aba===-1?700:500,borderBottom:aba===-1?`2px solid ${C.blueDark}`:'2px solid transparent',marginBottom:-2,display:'flex',alignItems:'center',gap:6,fontSize:14,...font}}>
          <Settings size={14}/> Configurações
        </button>
      </div>

      {/* CONFIG */}
      {aba===-1&&(
        <div style={{display:'grid',gap:16,gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))'}}>
          {contas.map(c=>(
            <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusLg,padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <div style={{fontSize:15,fontWeight:700,color:C.blueDark}}>{c.nome}</div>
                {editConta===c.id
                  ?<div style={{display:'flex',gap:6}}>
                    <button onClick={()=>salvarConta(c.id)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',borderRadius:7,border:'none',background:C.blueMid,color:'#fff',fontSize:12,cursor:'pointer',...font}}><Save size={12}/> Salvar</button>
                    <button onClick={()=>setEditConta(null)} style={{padding:'5px 10px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',cursor:'pointer'}}><X size={12}/></button>
                  </div>
                  :<button onClick={()=>{setEditConta(c.id);setEditVal({id_vendedor_erp:c.id_vendedor_erp,dias_reposicao:c.dias_reposicao})}} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 12px',borderRadius:7,border:`1px solid ${C.border}`,background:'transparent',fontSize:12,cursor:'pointer',...font}}>
                    <Pencil size={12}/> Editar
                  </button>}
              </div>
              <div style={{display:'grid',gap:12}}>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,...font}}>ID Vendedor no ERP (Fu)</div>
                  {editConta===c.id
                    ?<input type="number" value={editVal.id_vendedor_erp??''} onChange={e=>setEditVal(p=>({...p,id_vendedor_erp:parseInt(e.target.value)||0}))} style={inp}/>
                    :<div style={{fontSize:14,fontWeight:600,color:c.id_vendedor_erp===0?C.red:C.txt}}>{c.id_vendedor_erp===0?'⚠️ Não configurado':c.id_vendedor_erp}</div>}
                </div>
                <div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:4,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,...font}}>Tempo médio de reposição (dias)</div>
                  {editConta===c.id
                    ?<input type="number" value={editVal.dias_reposicao??''} onChange={e=>setEditVal(p=>({...p,dias_reposicao:parseInt(e.target.value)||1}))} style={inp}/>
                    :<div style={{fontSize:14,fontWeight:600}}>{c.dias_reposicao} dias</div>}
                </div>
                <div style={{background:'#F8FAFC',borderRadius:8,padding:'10px 14px',fontSize:12,color:C.muted}}>
                  <strong>Lógica de alerta:</strong><br/>
                  🟡 Atenção: estoque &lt; venda média × {Math.round(c.dias_reposicao*1.5)}d<br/>
                  🔴 Crítico: estoque &lt; venda média × {c.dias_reposicao}d<br/>
                  ⚫ Zerado: estoque = 0
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PAINEL DA CONTA */}
      {aba!==null&&aba!==-1&&(()=>{
        const conta=contas.find(c=>c.id===aba)
        const it=itens(aba);const r=res(aba)
        return(<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:12,marginBottom:18}}>
            {[{n:r.total,l:'Produtos',fg:C.blueMid},{n:r.ok,l:'OK',fg:C.green},{n:r.atencao,l:'Atenção',fg:C.amber},{n:r.critico,l:'Crítico/Zerado',fg:C.red}].map(({n,l,fg})=>(
              <div key={l} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radius,padding:'14px 16px'}}>
                <div style={{fontSize:22,fontWeight:700,color:fg,...font}}>{n}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:5,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,...font}}>{l}</div>
              </div>
            ))}
          </div>
          {conta?.id_vendedor_erp===0&&(
            <div style={{background:C.amberBg,color:C.amber,border:`1px solid ${C.amber}33`,borderRadius:C.radius,padding:'10px 14px',marginBottom:14,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
              <AlertTriangle size={15}/> ID Vendedor ERP não configurado — saídas automáticas desativadas. Configure em <strong>Configurações</strong>.
            </div>
          )}
          {it.length===0
            ?<div style={{textAlign:'center',color:C.muted,padding:50,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusLg}}>
              <Package size={32} color={C.hint} style={{marginBottom:8}}/><div style={{fontSize:14,...font}}>Nenhum produto. Clique em "Adicionar Produto".</div>
            </div>
            :<div style={{border:`1px solid ${C.border}`,borderRadius:C.radiusLg,overflow:'hidden'}}>
              <table style={{width:'100%',borderCollapse:'collapse',background:C.surface}}>
                <thead><tr>
                  <th style={th}>SKU</th><th style={th}>Produto</th>
                  <th style={{...th,textAlign:'center'}}>Alerta</th>
                  <th style={{...th,textAlign:'right'}}>Estoque</th>
                  <th style={{...th,textAlign:'right'}}>Mín.</th>
                  <th style={{...th,textAlign:'right'}}>Venda/dia</th>
                  <th style={{...th,textAlign:'right'}}>Dias rest.</th>
                  <th style={{...th,textAlign:'right'}}>Precisa repor</th>
                  <th style={th}>Anúncio</th><th style={th}>Ajuste</th>
                </tr></thead>
                <tbody>
                  {it.map(i=>{const al=ALERTA[i.alerta];return(
                    <tr key={i.id} style={{background:i.alerta==='CRITICO'||i.alerta==='ZERADO'?`${C.red}08`:i.alerta==='ATENCAO'?`${C.amber}08`:'transparent'}}>
                      <td style={{...td,fontWeight:700,color:C.blueDark}}>{i.referencia}</td>
                      <td style={{...td,whiteSpace:'normal',maxWidth:260}}>{i.nome_produto||'—'}</td>
                      <td style={{...td,textAlign:'center'}}>
                        <span style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,background:al.bg,color:al.fg}}>{al.icon} {al.label}</span>
                      </td>
                      <td style={{...tdR,color:i.estoque_atual===0?C.red:i.alerta==='CRITICO'?C.red:i.alerta==='ATENCAO'?C.amber:C.txt,fontSize:15}}>{fmtNum(i.estoque_atual)}</td>
                      <td style={tdR}>{i.estoque_minimo}</td>
                      <td style={tdR}>{i.media_diaria_30d>0?i.media_diaria_30d.toFixed(1):'—'}</td>
                      <td style={{...tdR,color:i.dias_restantes!=null&&i.dias_restantes<=i.dias_reposicao?C.red:C.txt}}>{i.dias_restantes!=null?`${i.dias_restantes}d`:'—'}</td>
                      <td style={tdR}>{i.estoque_necessario_reposicao>0?fmtNum(i.estoque_necessario_reposicao):'—'}</td>
                      <td style={{...td,fontSize:12,color:C.muted}}>{i.id_anuncio_ml||'—'}</td>
                      <td style={td}>
                        {ajustando===i.id
                          ?<div style={{display:'flex',gap:4,alignItems:'center'}}>
                            <input type="number" placeholder="+10 ou -3" value={ajusteVal} onChange={e=>setAjusteVal(e.target.value)} style={{width:80,border:`1px solid ${C.border}`,borderRadius:6,padding:'4px 6px',fontSize:12,...font}}/>
                            <button onClick={()=>ajustar(i)} style={{padding:'4px 8px',borderRadius:6,border:'none',background:C.blueMid,color:'#fff',cursor:'pointer'}}><Save size={11}/></button>
                            <button onClick={()=>setAjustando(null)} style={{padding:'4px 8px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',cursor:'pointer'}}><X size={11}/></button>
                          </div>
                          :<button onClick={()=>{setAjustando(i.id);setAjusteVal('')}} style={{padding:'4px 10px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:4,...font}}>
                            <Pencil size={11}/> Ajustar
                          </button>}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>}
        </>)
      })()}

      {/* MODAL */}
      {showNovo&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
          <div style={{background:'#fff',borderRadius:C.radiusLg,padding:28,width:420,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color:C.blueDark,marginBottom:20,...font}}>Adicionar Produto ao Full</div>
            <div style={{display:'grid',gap:14}}>
              <div>
                <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5,...font}}>Conta</label>
                <select value={novoContaId??''} onChange={e=>setNovoContaId(Number(e.target.value))} style={inp}>
                  {contas.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {[{k:'referencia',l:'SKU / Referência *',ph:'ex: 12345'},{k:'nome_produto',l:'Nome do Produto',ph:'ex: Capa Porca Roda'},{k:'id_anuncio_ml',l:'ID Anúncio ML (opcional)',ph:'ex: MLB1234567890'}].map(({k,l,ph})=>(
                <div key={k}>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5,...font}}>{l}</label>
                  <input value={(novoItem as any)[k]} onChange={e=>setNovoItem(p=>({...p,[k]:e.target.value}))} placeholder={ph} style={inp}/>
                </div>
              ))}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5,...font}}>Qtd. Atual no Full *</label>
                  <input type="number" value={novoItem.estoque_inicial} onChange={e=>setNovoItem(p=>({...p,estoque_inicial:e.target.value}))} placeholder="0" style={inp}/>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',display:'block',marginBottom:5,...font}}>Estoque Mínimo</label>
                  <input type="number" value={novoItem.estoque_minimo} onChange={e=>setNovoItem(p=>({...p,estoque_minimo:e.target.value}))} placeholder="5" style={inp}/>
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:10,marginTop:22,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowNovo(false)} style={{padding:'9px 16px',borderRadius:C.radius,border:`1px solid ${C.border}`,background:'transparent',fontSize:13,cursor:'pointer',...font}}>Cancelar</button>
              <button onClick={adicionarProduto} disabled={!novoItem.referencia} style={{padding:'9px 16px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',...font}}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
