import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, X, Save, ChevronDown, MessageCircle, Users, Calendar, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Periodo } from '../types'

type Nicho  = { id: number; nome: string }
type Parceiro = {
  id: number; nome: string; arroba: string | null; canal: string
  id_nicho: number | null; nicho_nome?: string; seguidores: number | null
  contato_whatsapp: string | null; contato_email: string | null
  status: string; tipo_acordo: string | null; valor_acordo: number | null
  vigencia_inicio: string | null; vigencia_fim: string | null
  detalhe_acordo: string | null; resultados: string | null
  criado_em: string
}
type Followup = { id: number; id_parceiro: number; data_followup: string; responsavel: string; nota: string }

const C = {
  blueDark:'var(--blue-dark)',blueMid:'var(--blue-mid)',surface:'var(--surface)',border:'var(--border)',
  txt:'var(--text-primary)',muted:'var(--text-muted)',hint:'var(--text-hint)',
  green:'var(--green)',greenBg:'var(--green-bg)',red:'var(--red)',redBg:'var(--red-bg)',
  amber:'var(--amber)',amberBg:'var(--amber-bg)',radius:'var(--radius)',radiusLg:'var(--radius-lg)',
}
const font = { fontFamily:'DM Sans, sans-serif' }

const STATUS_COR: Record<string,{bg:string;fg:string}> = {
  'Ativo':       {bg:'var(--green-bg)',  fg:'var(--green)'},
  'Negociando':  {bg:'var(--amber-bg)',  fg:'var(--amber)'},
  'Pausado':     {bg:'#EEF0F4',          fg:'var(--text-hint)'},
  'Encerrado':   {bg:'var(--red-bg)',    fg:'var(--red)'},
}
const CANAIS    = ['Instagram','YouTube','TikTok','Blog','Podcast','Outro']
const TIPOS     = ['Permuta','Comissão %','Cachê fixo','Misto']
const STATUS    = ['Ativo','Negociando','Pausado','Encerrado']
const inp:React.CSSProperties = {border:`1px solid var(--border)`,borderRadius:7,padding:'7px 10px',fontSize:13,width:'100%',fontFamily:'DM Sans, sans-serif'}

// ── Autocomplete de nicho ──────────────────────────────────────────────────
function NichoSelect({value,onChange,nichos,onNichoCreated}:{value:number|null;onChange:(id:number|null)=>void;nichos:Nicho[];onNichoCreated:(n:Nicho)=>void}) {
  const [q,setQ]           = useState('')
  const [aberto,setAberto] = useState(false)
  const [criando,setCriando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const atual = nichos.find(n=>n.id===value)
  const filtrados = nichos.filter(n=>n.nome.toLowerCase().includes(q.toLowerCase()))

  useEffect(()=>{
    const fn=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setAberto(false) }
    document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)
  },[])

  async function criarNicho(){
    if(!q.trim())return
    const{data,error}=await supabase.from('mkt_nichos').insert({nome:q.trim()}).select().single()
    if(!error&&data){ onNichoCreated(data as Nicho); onChange(data.id); setQ(''); setAberto(false); setCriando(false) }
  }

  return(
    <div ref={ref} style={{position:'relative'}}>
      <div onClick={()=>setAberto(v=>!v)} style={{...inp,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'#fff'}}>
        <span style={{color:atual?C.txt:C.hint}}>{atual?.nome??'Selecione o nicho…'}</span>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {value&&<button onClick={e=>{e.stopPropagation();onChange(null)}} style={{border:'none',background:'transparent',cursor:'pointer',color:C.hint,padding:0,lineHeight:1}}><X size={12}/></button>}
          <ChevronDown size={13} color={C.hint}/>
        </div>
      </div>
      {aberto&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'#fff',border:`1px solid ${C.border}`,borderRadius:C.radius,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.border}`}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar ou criar nicho…" style={{...inp,padding:'5px 8px',fontSize:12}}/>
          </div>
          <div style={{maxHeight:180,overflowY:'auto'}}>
            {filtrados.map(n=>(
              <div key={n.id} onClick={()=>{onChange(n.id);setAberto(false);setQ('')}} style={{padding:'9px 12px',cursor:'pointer',fontSize:13,fontFamily:'DM Sans,sans-serif',background:n.id===value?'#EFF6FF':'transparent'}}>
                {n.nome}
              </div>
            ))}
            {q&&!filtrados.find(n=>n.nome.toLowerCase()===q.toLowerCase())&&(
              <div style={{padding:'9px 12px',borderTop:`1px solid ${C.border}`}}>
                {criando
                  ?<div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:12,color:C.muted,...font}}>Criar "<strong>{q}</strong>"?</span>
                    <button onClick={criarNicho} style={{padding:'3px 10px',borderRadius:6,border:'none',background:C.blueMid,color:'#fff',fontSize:12,cursor:'pointer',...font}}>Criar</button>
                    <button onClick={()=>setCriando(false)} style={{padding:'3px 8px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',fontSize:12,cursor:'pointer',...font}}>Cancelar</button>
                  </div>
                  :<button onClick={()=>setCriando(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:6,border:`1px dashed ${C.blueMid}`,background:'transparent',color:C.blueMid,fontSize:12,cursor:'pointer',...font}}>
                    <Plus size={12}/> Criar nicho "{q}"
                  </button>}
              </div>
            )}
            {filtrados.length===0&&!q&&<div style={{padding:'12px',fontSize:12,color:C.muted,textAlign:'center',...font}}>Digite para buscar ou criar</div>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Drawer do parceiro ─────────────────────────────────────────────────────
function Drawer({parceiro,nichos,onNichoCreated,onClose,onSaved}:{parceiro:Parceiro|null;nichos:Nicho[];onNichoCreated:(n:Nicho)=>void;onClose:()=>void;onSaved:()=>void}) {
  const isNovo = parceiro===null
  const vazio:Partial<Parceiro> = {nome:'',arroba:'',canal:'Instagram',status:'Negociando',id_nicho:null,seguidores:null,contato_whatsapp:'',contato_email:'',tipo_acordo:null,valor_acordo:null,vigencia_inicio:null,vigencia_fim:null,detalhe_acordo:'',resultados:''}
  const [form,setForm]         = useState<Partial<Parceiro>>(parceiro??vazio)
  const [followups,setFollowups] = useState<Followup[]>([])
  const [novaFU,setNovaFU]     = useState({responsavel:'',nota:''})
  const [salvando,setSalvando] = useState(false)

  const set=(k:keyof Parceiro,v:any)=>setForm(f=>({...f,[k]:v}))

  useEffect(()=>{
    if(parceiro?.id){
      supabase.from('mkt_followups').select('*').eq('id_parceiro',parceiro.id).order('data_followup',{ascending:false}).then(({data})=>{ if(data)setFollowups(data) })
    }
  },[parceiro?.id])

  async function salvar(){
    setSalvando(true)
    const payload={...form,atualizado_em:new Date().toISOString()}
    if(isNovo){
      const{error}=await supabase.from('mkt_parceiros').insert(payload)
      if(!error){onSaved();onClose()}
    }else{
      const{error}=await supabase.from('mkt_parceiros').update(payload).eq('id',parceiro!.id)
      if(!error)onSaved()
    }
    setSalvando(false)
  }

  async function addFollowup(){
    if(!novaFU.responsavel||!novaFU.nota||!parceiro?.id)return
    const{data}=await supabase.from('mkt_followups').insert({id_parceiro:parceiro.id,data_followup:new Date().toISOString().split('T')[0],...novaFU}).select().single()
    if(data){setFollowups(f=>[data,...f]);setNovaFU({responsavel:'',nota:''})}
  }
  async function delFollowup(id:number){
    await supabase.from('mkt_followups').delete().eq('id',id)
    setFollowups(f=>f.filter(x=>x.id!==id))
  }

  const label=(t:string)=><div style={{fontSize:11,fontWeight:600,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:5,...font}}>{t}</div>

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.35)',zIndex:200,display:'flex',justifyContent:'flex-end'}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{width:520,background:'#fff',height:'100%',overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column'}}>
        {/* Header drawer */}
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff',zIndex:1}}>
          <div style={{fontSize:16,fontWeight:700,color:C.blueDark,...font}}>{isNovo?'Novo Parceiro':form.nome||'Parceiro'}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={salvar} disabled={salvando||!form.nome} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',opacity:!form.nome?0.5:1,...font}}>
              <Save size={13}/> {salvando?'Salvando…':'Salvar'}
            </button>
            <button onClick={onClose} style={{padding:'8px 10px',borderRadius:C.radius,border:`1px solid ${C.border}`,background:'transparent',cursor:'pointer'}}><X size={15}/></button>
          </div>
        </div>

        <div style={{padding:24,display:'grid',gap:18,flex:1}}>
          {/* DADOS BÁSICOS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div style={{gridColumn:'1/-1'}}>
              {label('Nome do Parceiro *')}
              <input value={form.nome??''} onChange={e=>set('nome',e.target.value)} placeholder="ex: João Caminhoneiro" style={inp}/>
            </div>
            <div>
              {label('@ / Handle')}
              <input value={form.arroba??''} onChange={e=>set('arroba',e.target.value)} placeholder="@joaocaminhoneiro" style={inp}/>
            </div>
            <div>
              {label('Canal')}
              <select value={form.canal??'Instagram'} onChange={e=>set('canal',e.target.value)} style={inp}>
                {CANAIS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              {label('Nicho')}
              <NichoSelect value={form.id_nicho??null} onChange={v=>set('id_nicho',v)} nichos={nichos} onNichoCreated={onNichoCreated}/>
            </div>
            <div>
              {label('Seguidores / Audiência')}
              <input type="number" value={form.seguidores??''} onChange={e=>set('seguidores',parseInt(e.target.value)||null)} placeholder="ex: 150000" style={inp}/>
            </div>
          </div>

          {/* CONTATO */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              {label('WhatsApp')}
              <input value={form.contato_whatsapp??''} onChange={e=>set('contato_whatsapp',e.target.value)} placeholder="(41) 99999-9999" style={inp}/>
            </div>
            <div>
              {label('E-mail')}
              <input value={form.contato_email??''} onChange={e=>set('contato_email',e.target.value)} placeholder="contato@email.com" style={inp}/>
            </div>
          </div>

          {/* STATUS + ACORDO */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
            <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:12,...font}}>Acordo</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div>
                {label('Status')}
                <select value={form.status??'Negociando'} onChange={e=>set('status',e.target.value)} style={inp}>
                  {STATUS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                {label('Tipo de Acordo')}
                <select value={form.tipo_acordo??''} onChange={e=>set('tipo_acordo',e.target.value||null)} style={inp}>
                  <option value="">Selecione…</option>
                  {TIPOS.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                {label('Valor / %')}
                <input type="number" value={form.valor_acordo??''} onChange={e=>set('valor_acordo',parseFloat(e.target.value)||null)} placeholder="ex: 10 ou 500" style={inp}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>{label('Início')}<input type="date" value={form.vigencia_inicio??''} onChange={e=>set('vigencia_inicio',e.target.value||null)} style={inp}/></div>
                <div>{label('Fim')}<input type="date" value={form.vigencia_fim??''} onChange={e=>set('vigencia_fim',e.target.value||null)} style={inp}/></div>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                {label('Detalhe do Acordo')}
                <textarea value={form.detalhe_acordo??''} onChange={e=>set('detalhe_acordo',e.target.value)} placeholder="O que foi combinado, entregas esperadas, frequência de posts…" rows={3} style={{...inp,resize:'vertical'}}/>
              </div>
              <div style={{gridColumn:'1/-1'}}>
                {label('Resultados')}
                <textarea value={form.resultados??''} onChange={e=>set('resultados',e.target.value)} placeholder="Vendas geradas, cupom usado, leads, visualizações…" rows={2} style={{...inp,resize:'vertical'}}/>
              </div>
            </div>
          </div>

          {/* FOLLOWUPS */}
          {!isNovo&&(
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:12,...font}}>Histórico de Followups</div>
              {/* novo followup */}
              <div style={{background:'#F8FAFC',borderRadius:C.radius,padding:14,marginBottom:14}}>
                <div style={{display:'grid',gap:8}}>
                  <input value={novaFU.responsavel} onChange={e=>setNovaFU(f=>({...f,responsavel:e.target.value}))} placeholder="Seu nome" style={inp}/>
                  <textarea value={novaFU.nota} onChange={e=>setNovaFU(f=>({...f,nota:e.target.value}))} placeholder="O que foi combinado, resultado da conversa…" rows={2} style={{...inp,resize:'vertical'}}/>
                  <button onClick={addFollowup} disabled={!novaFU.responsavel||!novaFU.nota} style={{padding:'8px 14px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',opacity:(!novaFU.responsavel||!novaFU.nota)?0.5:1,...font}}>
                    + Registrar followup
                  </button>
                </div>
              </div>
              {/* lista */}
              <div style={{display:'grid',gap:10}}>
                {followups.length===0
                  ?<div style={{fontSize:12,color:C.hint,textAlign:'center',padding:16,...font}}>Nenhum followup ainda.</div>
                  :followups.map(f=>(
                    <div key={f.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radius,padding:'10px 14px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.blueDark,...font}}>{f.responsavel}</div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <div style={{fontSize:11,color:C.muted,...font}}>{new Date(f.data_followup+'T12:00:00').toLocaleDateString('pt-BR')}</div>
                          <button onClick={()=>delFollowup(f.id)} style={{border:'none',background:'transparent',cursor:'pointer',color:C.hint,padding:0}}><Trash2 size={12}/></button>
                        </div>
                      </div>
                      <div style={{fontSize:13,color:C.txt,...font}}>{f.nota}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────
export default function Parceiros(_props:{periodo?:Periodo}) {
  const [parceiros,setParceiros] = useState<Parceiro[]>([])
  const [nichos,setNichos]       = useState<Nicho[]>([])
  const [loading,setLoading]     = useState(false)
  const [busca,setBusca]         = useState('')
  const [filtroStatus,setFiltroStatus] = useState<string>('Todos')
  const [drawer,setDrawer]       = useState<Parceiro|null|undefined>(undefined) // undefined=fechado, null=novo
  
  const carregar = useCallback(async()=>{
    setLoading(true)
    const [{data:p},{data:n}] = await Promise.all([
      supabase.from('mkt_parceiros').select('*, mkt_nichos(nome)').order('criado_em',{ascending:false}),
      supabase.from('mkt_nichos').select('*').order('nome'),
    ])
    if(p) setParceiros(p.map((x:any)=>({...x,nicho_nome:x.mkt_nichos?.nome})))
    if(n) setNichos(n)
    setLoading(false)
  },[])
  useEffect(()=>{carregar()},[])

  const lista = parceiros.filter(p=>{
    const q=busca.toLowerCase()
    const matchQ=!q||(p.nome.toLowerCase().includes(q)||(p.arroba??'').toLowerCase().includes(q)||(p.nicho_nome??'').toLowerCase().includes(q))
    const matchS=filtroStatus==='Todos'||p.status===filtroStatus
    return matchQ&&matchS
  })

  const resumo={
    total:parceiros.length,
    ativos:parceiros.filter(p=>p.status==='Ativo').length,
    negociando:parceiros.filter(p=>p.status==='Negociando').length,
  }

  async function excluir(id:number){
    await supabase.from('mkt_parceiros').delete().eq('id',id)
    carregar()
  }

  return(
    <div style={{padding:24,...font}}>
      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20,flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:C.blueDark}}>Parceiros de Marketing</div>
          <div style={{fontSize:12.5,color:C.muted,marginTop:3}}>Gestão de influenciadores, criadores e parceiros comerciais</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={carregar} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:C.radius,border:`1px solid ${C.border}`,background:C.surface,color:C.txt,fontSize:13,cursor:'pointer',...font}}>
            <RefreshCw size={13}/>
          </button>
          <button onClick={()=>setDrawer(null)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',...font}}>
            <Plus size={14}/> Novo Parceiro
          </button>
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:12,marginBottom:18}}>
        {[{n:resumo.total,l:'Total',fg:C.blueMid},{n:resumo.ativos,l:'Ativos',fg:C.green},{n:resumo.negociando,l:'Negociando',fg:C.amber}].map(({n,l,fg})=>(
          <div key={l} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radius,padding:'14px 16px'}}>
            <div style={{fontSize:22,fontWeight:700,color:fg,...font}}>{n}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:5,textTransform:'uppercase',letterSpacing:'.4px',fontWeight:600,...font}}>{l}</div>
          </div>
        ))}
      </div>

      {/* FILTROS */}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:16}}>
        <div style={{position:'relative',flex:1,minWidth:200}}>
          <Search size={14} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:C.hint}}/>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar por nome, @ ou nicho…" style={{...inp,paddingLeft:32}}/>
        </div>
        <div style={{display:'inline-flex',background:'#F1F5F9',border:`1px solid ${C.border}`,borderRadius:C.radius,padding:3,gap:2}}>
          {['Todos',...STATUS].map(s=>(
            <button key={s} onClick={()=>setFiltroStatus(s)} style={{padding:'6px 12px',borderRadius:7,border:'none',cursor:'pointer',fontSize:12.5,fontWeight:600,background:filtroStatus===s?C.surface:'transparent',color:filtroStatus===s?C.blueDark:C.muted,boxShadow:filtroStatus===s?'0 1px 3px rgba(0,0,0,0.08)':'none',...font}}>{s}</button>
          ))}
        </div>
      </div>

      {/* GRID DE CARDS */}
      {loading
        ?<div style={{textAlign:'center',padding:40,color:C.muted,...font}}>Carregando…</div>
        :lista.length===0
          ?<div style={{textAlign:'center',padding:50,color:C.muted,background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusLg,...font}}>
            <Users size={32} color={C.hint} style={{marginBottom:8}}/><br/>
            {busca||filtroStatus!=='Todos'?'Nenhum parceiro encontrado com esse filtro.':'Nenhum parceiro cadastrado ainda.'}
          </div>
          :<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {lista.map(p=>{
              const st=STATUS_COR[p.status]??{bg:'#EEF0F4',fg:C.hint}
              const vencendo=p.vigencia_fim&&new Date(p.vigencia_fim)<new Date(Date.now()+30*86400000)&&p.status==='Ativo'
              return(
                <div key={p.id} onClick={()=>setDrawer(p)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:C.radiusLg,padding:16,cursor:'pointer',transition:'box-shadow .15s',boxShadow:'none'}}
                  onMouseEnter={e=>(e.currentTarget.style.boxShadow='0 4px 16px rgba(26,58,143,0.10)')}
                  onMouseLeave={e=>(e.currentTarget.style.boxShadow='none')}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:C.blueDark,...font}}>{p.nome}</div>
                      {p.arroba&&<div style={{fontSize:12,color:C.muted,...font}}>{p.arroba} · {p.canal}</div>}
                    </div>
                    <span style={{background:st.bg,color:st.fg,fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,flexShrink:0,...font}}>{p.status}</span>
                  </div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:10}}>
                    {p.nicho_nome&&<span style={{background:'#EEF2FF',color:C.blueDark,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}>{p.nicho_nome}</span>}
                    {p.seguidores&&<span style={{background:'#F1F5F9',color:C.muted,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}><Users size={10}/> {p.seguidores.toLocaleString('pt-BR')}</span>}
                    {p.tipo_acordo&&<span style={{background:'#F1F5F9',color:C.muted,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}>{p.tipo_acordo}</span>}
                  </div>
                  {vencendo&&<div style={{fontSize:11,color:C.amber,fontWeight:600,marginBottom:8,...font}}>⚠️ Acordo vence em breve</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',gap:12}}>
                      {p.contato_whatsapp&&<a href={`https://wa.me/55${p.contato_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:C.green,display:'flex',alignItems:'center',gap:4,fontSize:12,...font}}>
                        <MessageCircle size={13}/> WhatsApp
                      </a>}
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      {p.vigencia_fim&&<span style={{fontSize:11,color:C.hint,...font}}><Calendar size={11}/> até {new Date(p.vigencia_fim+'T12:00:00').toLocaleDateString('pt-BR',{month:'short',day:'2-digit'})}</span>}
                      <button onClick={e=>{e.stopPropagation();if(confirm('Excluir parceiro?'))excluir(p.id)}} style={{border:'none',background:'transparent',cursor:'pointer',color:C.hint,padding:'0 4px',marginLeft:4}}><Trash2 size={13}/></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>}

      {drawer!==undefined&&(
        <Drawer
          parceiro={drawer}
          nichos={nichos}
          onNichoCreated={n=>setNichos(ns=>[...ns,n].sort((a,b)=>a.nome.localeCompare(b.nome)))}
          onClose={()=>setDrawer(undefined)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}
