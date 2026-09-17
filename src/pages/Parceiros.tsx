import React, { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Search, X, Save, ChevronDown, MessageCircle, Users, Calendar, Trash2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePeriodo } from '../components/layout/AppShell'
import type { Periodo } from '../types'

type Nicho      = { id: number; nome: string }
type Modalidade = { id: number; nome: string }

/** Um acordo do parceiro. O mesmo parceiro pode ter vários — ex.: 10% no Varejo e 5% no Atacado.
 *  `id` negativo = linha criada na tela, ainda não existe no banco. */
type Acordo = {
  id: number
  id_modalidade: number | null
  modalidade_nome?: string
  tipo_acordo: string | null
  valor_acordo: number | null
  vigencia_inicio: string | null
  vigencia_fim: string | null
  detalhe_acordo: string | null
}

type Parceiro = {
  id: number; nome: string; arroba: string | null; canal: string
  id_nicho: number | null; nicho_nome?: string; seguidores: number | null
  contato_whatsapp: string | null; contato_email: string | null
  status: string; resultados: string | null
  criado_em: string
  acordos?: Acordo[]
}

// Só estas colunas existem em mkt_parceiros. O objeto em memória carrega junto o embed
// (mkt_nichos, mkt_parceiro_acordos) e campos derivados; mandar isso num insert/update faz o
// PostgREST responder 400 "column does not exist".
const COLS_PARCEIRO = ['nome','arroba','canal','id_nicho','seguidores','contato_whatsapp',
                       'contato_email','status','resultados'] as const
function payloadParceiro(f: Partial<Parceiro>) {
  const out: Record<string,any> = {}
  for (const k of COLS_PARCEIRO) if (k in f) out[k] = (f as any)[k]
  return out
}
type Followup = { id: number; id_parceiro: number; data_followup: string; responsavel: string; nota: string }

const C = {
  blueDark:'var(--blue-dark)',blueMid:'var(--blue-mid)',surface:'var(--surface)',border:'var(--border)',
  txt:'var(--text-primary)',muted:'var(--text-muted)',hint:'var(--text-hint)',
  green:'var(--green)',greenBg:'var(--green-bg)',red:'var(--red)',redBg:'var(--red-bg)',
  amber:'var(--amber)',amberBg:'var(--amber-bg)',radius:'var(--radius)',radiusLg:'var(--radius-lg)',
}
const font = { fontFamily:'var(--font-sans)' }

const STATUS_COR: Record<string,{bg:string;fg:string}> = {
  'Ativo':       {bg:'var(--green-bg)',  fg:'var(--green)'},
  'Negociando':  {bg:'var(--amber-bg)',  fg:'var(--amber)'},
  'Pausado':     {bg:'var(--surface-sunken)',          fg:'var(--text-hint)'},
  'Encerrado':   {bg:'var(--red-bg)',    fg:'var(--red)'},
}
const CANAIS    = ['Instagram','YouTube','TikTok','Blog','Podcast','Outro']
const TIPOS     = ['Permuta','Comissão %','Cachê fixo','Misto']
const STATUS    = ['Ativo','Negociando','Pausado','Encerrado']
const inp:React.CSSProperties = {border:`1px solid var(--border)`,borderRadius:7,padding:'7px 10px',fontSize:13,width:'100%',fontFamily:'var(--font-sans)'}

/** Rótulo curto de um acordo para o chip do card: "Varejo · 10%", "Atacado · R$ 500", "Permuta". */
function resumoAcordo(a: Acordo): string {
  const val = a.valor_acordo
  let v = ''
  if (val != null && val > 0) {
    v = a.tipo_acordo === 'Comissão %'
      ? `${val.toLocaleString('pt-BR')}%`
      : `R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:2})}`
  } else if (a.tipo_acordo) {
    v = a.tipo_acordo
  }
  const m = a.modalidade_nome
  return m && v ? `${m} · ${v}` : (m || v || 'Acordo sem detalhe')
}

/** Vigência que vence primeiro entre os acordos — é ela que dispara o aviso no card. */
function fimMaisProximo(acordos: Acordo[] = []): string | null {
  const fins = acordos.map(a=>a.vigencia_fim).filter((d):d is string=>!!d).sort()
  return fins[0] ?? null
}

// ── Autocomplete com "criar na hora" ───────────────────────────────────────
// Serve nicho e modalidade: as duas são listas curtas que crescem conforme o uso.
function ListaSelect({value,onChange,itens,onCriado,tabela,rotulo,artigo='o'}:{
  value:number|null; onChange:(id:number|null)=>void; itens:{id:number;nome:string}[]
  onCriado:(n:{id:number;nome:string})=>void; tabela:'mkt_nichos'|'mkt_modalidades'
  rotulo:string; artigo?:'o'|'a'   // "Selecione O nicho" x "Selecione A modalidade"
}) {
  const [q,setQ]           = useState('')
  const [aberto,setAberto] = useState(false)
  const [criando,setCriando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const atual = itens.find(n=>n.id===value)
  const filtrados = itens.filter(n=>n.nome.toLowerCase().includes(q.toLowerCase()))

  useEffect(()=>{
    const fn=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setAberto(false) }
    document.addEventListener('mousedown',fn);return()=>document.removeEventListener('mousedown',fn)
  },[])

  async function criar(){
    if(!q.trim())return
    const{data,error}=await supabase.from(tabela).insert({nome:q.trim()}).select().single()
    if(!error&&data){ onCriado(data as {id:number;nome:string}); onChange(data.id); setQ(''); setAberto(false); setCriando(false) }
  }

  return(
    <div ref={ref} style={{position:'relative'}}>
      <div onClick={()=>setAberto(v=>!v)} style={{...inp,display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',background:'var(--surface-card)'}}>
        <span style={{color:atual?C.txt:C.hint,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{atual?.nome??`Selecione ${artigo} ${rotulo}…`}</span>
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {value&&<button onClick={e=>{e.stopPropagation();onChange(null)}} style={{border:'none',background:'transparent',cursor:'pointer',color:C.hint,padding:0,lineHeight:1}}><X size={12}/></button>}
          <ChevronDown size={13} color={C.hint}/>
        </div>
      </div>
      {aberto&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--surface-card)',border:`1px solid ${C.border}`,borderRadius:C.radius,zIndex:50,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',overflow:'hidden'}}>
          <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.border}`}}>
            <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder={`Buscar ou criar ${rotulo}…`} style={{...inp,padding:'5px 8px',fontSize:12}}/>
          </div>
          <div style={{maxHeight:180,overflowY:'auto'}}>
            {filtrados.map(n=>(
              <div key={n.id} onClick={()=>{onChange(n.id);setAberto(false);setQ('')}} style={{padding:'9px 12px',cursor:'pointer',fontSize:13,fontFamily:'var(--font-sans)',background:n.id===value?'var(--feedback-info-bg)':'transparent'}}>
                {n.nome}
              </div>
            ))}
            {q&&!filtrados.find(n=>n.nome.toLowerCase()===q.toLowerCase())&&(
              <div style={{padding:'9px 12px',borderTop:`1px solid ${C.border}`}}>
                {criando
                  ?<div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:12,color:C.muted,...font}}>Criar "<strong>{q}</strong>"?</span>
                    <button onClick={criar} style={{padding:'3px 10px',borderRadius:6,border:'none',background:C.blueMid,color:'var(--surface-card)',fontSize:12,cursor:'pointer',...font}}>Criar</button>
                    <button onClick={()=>setCriando(false)} style={{padding:'3px 8px',borderRadius:6,border:`1px solid ${C.border}`,background:'transparent',fontSize:12,cursor:'pointer',...font}}>Cancelar</button>
                  </div>
                  :<button onClick={()=>setCriando(true)} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:6,border:`1px dashed ${C.blueMid}`,background:'transparent',color:C.blueMid,fontSize:12,cursor:'pointer',...font}}>
                    <Plus size={12}/> Criar {rotulo} "{q}"
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
function Drawer({parceiro,nichos,modalidades,onNichoCreated,onModalidadeCreated,onClose,onSaved}:{
  parceiro:Parceiro|null; nichos:Nicho[]; modalidades:Modalidade[]
  onNichoCreated:(n:Nicho)=>void; onModalidadeCreated:(m:Modalidade)=>void
  onClose:()=>void; onSaved:()=>void
}) {
  const isNovo = parceiro===null
  const vazio:Partial<Parceiro> = {nome:'',arroba:'',canal:'Instagram',status:'Negociando',id_nicho:null,seguidores:null,contato_whatsapp:'',contato_email:'',resultados:''}
  const [form,setForm]         = useState<Partial<Parceiro>>(parceiro??vazio)
  const [acordos,setAcordos]   = useState<Acordo[]>(parceiro?.acordos ?? [])
  const [followups,setFollowups] = useState<Followup[]>([])
  const [novaFU,setNovaFU]     = useState({responsavel:'',nota:''})
  const [salvando,setSalvando] = useState(false)
  const [erro,setErro]         = useState<string|null>(null)

  const set=(k:keyof Parceiro,v:any)=>setForm(f=>({...f,[k]:v}))

  // id negativo = acordo que só existe na tela; vira id de verdade no insert
  const novoAcordoId = useRef(-1)
  function addAcordo(){
    setAcordos(a=>[...a,{id:novoAcordoId.current--,id_modalidade:null,tipo_acordo:null,valor_acordo:null,
                         vigencia_inicio:null,vigencia_fim:null,detalhe_acordo:''}])
  }
  const setAcordo=(id:number,k:keyof Acordo,v:any)=>setAcordos(as=>as.map(a=>a.id===id?{...a,[k]:v}:a))
  const removeAcordo=(id:number)=>setAcordos(as=>as.filter(a=>a.id!==id))

  useEffect(()=>{
    if(parceiro?.id){
      supabase.from('mkt_followups').select('*').eq('id_parceiro',parceiro.id).order('data_followup',{ascending:false}).then(({data})=>{ if(data)setFollowups(data) })
    }
  },[parceiro?.id])

  const ACORDO_COLS = 'id,id_modalidade,tipo_acordo,valor_acordo,vigencia_inicio,vigencia_fim,detalhe_acordo,mkt_modalidades(nome)'

  /** Sincroniza a lista de acordos do parceiro: apaga o que saiu, atualiza o que ficou,
   *  insere o que é novo.
   *
   *  O "que saiu" vem de uma leitura do banco, e não do que o drawer tinha ao abrir: depois do
   *  primeiro save aquele retrato fica velho, e remover um acordo não apagava nada.
   *  No fim recarrega a lista para os acordos recém-inseridos trocarem o id negativo pelo id
   *  real — senão salvar duas vezes seguidas inseria tudo de novo, duplicado. */
  async function salvarAcordos(idParceiro:number){
    const{data:atuais,error:eAtuais}=await supabase
      .from('mkt_parceiro_acordos').select('id').eq('id_parceiro',idParceiro)
    if(eAtuais)throw eAtuais

    const vivos     = new Set(acordos.filter(a=>a.id>0).map(a=>a.id))
    const removidos = (atuais??[]).map(a=>a.id).filter(id=>!vivos.has(id))
    if(removidos.length){
      const{error}=await supabase.from('mkt_parceiro_acordos').delete().in('id',removidos)
      if(error)throw error
    }

    for(const a of acordos){
      const campos={id_modalidade:a.id_modalidade,tipo_acordo:a.tipo_acordo,valor_acordo:a.valor_acordo,
                    vigencia_inicio:a.vigencia_inicio,vigencia_fim:a.vigencia_fim,detalhe_acordo:a.detalhe_acordo}
      const{error} = a.id>0
        ? await supabase.from('mkt_parceiro_acordos').update({...campos,atualizado_em:new Date().toISOString()}).eq('id',a.id)
        : await supabase.from('mkt_parceiro_acordos').insert({...campos,id_parceiro:idParceiro})
      if(error)throw error
    }

    const{data:frescos}=await supabase.from('mkt_parceiro_acordos')
      .select(ACORDO_COLS).eq('id_parceiro',idParceiro).order('id')
    if(frescos)setAcordos(frescos.map((a:any)=>({...a,modalidade_nome:a.mkt_modalidades?.nome})))
  }

  async function salvar(){
    setSalvando(true); setErro(null)
    try{
      let id = parceiro?.id
      if(isNovo){
        const{data,error}=await supabase.from('mkt_parceiros').insert(payloadParceiro(form)).select('id').single()
        if(error)throw error
        id = data.id                       // precisa do id antes de gravar os acordos
      }else{
        const{error}=await supabase.from('mkt_parceiros')
          .update({...payloadParceiro(form),atualizado_em:new Date().toISOString()}).eq('id',id!)
        if(error)throw error
      }
      await salvarAcordos(id!)
      onSaved()
      if(isNovo)onClose()
    }catch(e:any){
      setErro(e?.message??'Não foi possível salvar.')
    }finally{
      setSalvando(false)
    }
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
      <div className="parc-drawer" style={{width:520,maxWidth:'100vw',background:'var(--surface-card)',height:'100%',overflowY:'auto',boxShadow:'-8px 0 40px rgba(0,0,0,0.15)',display:'flex',flexDirection:'column'}}>
        {/* Header drawer */}
        <div style={{padding:'20px 24px',borderBottom:`1px solid ${C.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'var(--surface-card)',zIndex:1}}>
          <div style={{fontSize:16,fontWeight:700,color:C.blueDark,...font}}>{isNovo?'Novo Parceiro':form.nome||'Parceiro'}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={salvar} disabled={salvando||!form.nome} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'var(--surface-card)',fontWeight:700,fontSize:13,cursor:'pointer',opacity:!form.nome?0.5:1,...font}}>
              <Save size={13}/> {salvando?'Salvando…':'Salvar'}
            </button>
            <button onClick={onClose} style={{padding:'8px 10px',borderRadius:C.radius,border:`1px solid ${C.border}`,background:'transparent',cursor:'pointer'}}><X size={15}/></button>
          </div>
        </div>

        {erro&&(
          <div style={{margin:'14px 24px 0',background:C.redBg,color:C.red,border:'1px solid var(--feedback-danger-border)',borderRadius:C.radius,padding:'9px 12px',fontSize:12.5,...font}}>
            Não salvou: {erro}
          </div>
        )}

        <div style={{padding:24,display:'grid',gap:18,flex:1}}>
          {/* DADOS BÁSICOS */}
          <div className="parc-grid2" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
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
              <ListaSelect value={form.id_nicho??null} onChange={v=>set('id_nicho',v)} itens={nichos} onCriado={onNichoCreated} tabela="mkt_nichos" rotulo="nicho"/>
            </div>
            <div>
              {label('Seguidores / Audiência')}
              <input type="number" value={form.seguidores??''} onChange={e=>set('seguidores',parseInt(e.target.value)||null)} placeholder="ex: 150000" style={inp}/>
            </div>
          </div>

          {/* CONTATO */}
          <div className="parc-grid2" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
            <div>
              {label('WhatsApp')}
              <input value={form.contato_whatsapp??''} onChange={e=>set('contato_whatsapp',e.target.value)} placeholder="(41) 99999-9999" style={inp}/>
            </div>
            <div>
              {label('E-mail')}
              <input value={form.contato_email??''} onChange={e=>set('contato_email',e.target.value)} placeholder="contato@email.com" style={inp}/>
            </div>
          </div>

          {/* STATUS */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
            <div className="parc-grid2" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
              <div>
                {label('Status')}
                <select value={form.status??'Negociando'} onChange={e=>set('status',e.target.value)} style={inp}>
                  {STATUS.map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ACORDOS — o mesmo parceiro pode ter vários (Varejo, Atacado…) */}
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blueDark,...font}}>
                Acordos {acordos.length>0&&<span style={{color:C.hint,fontWeight:600}}>({acordos.length})</span>}
              </div>
              <button onClick={addAcordo} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:C.radius,border:`1px dashed ${C.blueMid}`,background:'transparent',color:C.blueMid,fontSize:12,fontWeight:600,cursor:'pointer',...font}}>
                <Plus size={12}/> Adicionar acordo
              </button>
            </div>

            {acordos.length===0
              ?<div style={{background:'var(--surface-subtle)',border:`1px dashed ${C.border}`,borderRadius:C.radius,padding:'18px 14px',textAlign:'center',fontSize:12.5,color:C.muted,...font}}>
                Nenhum acordo ainda. Use "Adicionar acordo" — um por modalidade,
                se a comissão for diferente no Varejo e no Atacado.
              </div>
              :<div style={{display:'grid',gap:12}}>
                {acordos.map((a,i)=>(
                  <div key={a.id} style={{background:'var(--surface-subtle)',border:`1px solid ${C.border}`,borderRadius:C.radius,padding:14}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.muted,textTransform:'uppercase',letterSpacing:'.4px',...font}}>Acordo {i+1}</div>
                      <button onClick={()=>removeAcordo(a.id)} title="Remover acordo" style={{border:'none',background:'transparent',cursor:'pointer',color:C.hint,padding:0,lineHeight:1}}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                    <div className="parc-grid2" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
                      <div>
                        {label('Modalidade')}
                        <ListaSelect value={a.id_modalidade} onChange={v=>setAcordo(a.id,'id_modalidade',v)}
                          itens={modalidades} onCriado={onModalidadeCreated} tabela="mkt_modalidades" rotulo="modalidade" artigo="a"/>
                      </div>
                      <div>
                        {label('Tipo de Acordo')}
                        <select value={a.tipo_acordo??''} onChange={e=>setAcordo(a.id,'tipo_acordo',e.target.value||null)} style={inp}>
                          <option value="">Selecione…</option>
                          {TIPOS.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        {label('Valor / %')}
                        <input type="number" value={a.valor_acordo??''} onChange={e=>setAcordo(a.id,'valor_acordo',e.target.value===''?null:parseFloat(e.target.value))} placeholder="ex: 10 ou 500" style={inp}/>
                      </div>
                      <div className="parc-grid2" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:8}}>
                        <div>{label('Início')}<input type="date" value={a.vigencia_inicio??''} onChange={e=>setAcordo(a.id,'vigencia_inicio',e.target.value||null)} style={inp}/></div>
                        <div>{label('Fim')}<input type="date" value={a.vigencia_fim??''} onChange={e=>setAcordo(a.id,'vigencia_fim',e.target.value||null)} style={inp}/></div>
                      </div>
                      <div style={{gridColumn:'1/-1'}}>
                        {label('Detalhe do Acordo')}
                        <textarea value={a.detalhe_acordo??''} onChange={e=>setAcordo(a.id,'detalhe_acordo',e.target.value)} placeholder="O que foi combinado, entregas esperadas, frequência de posts…" rows={2} style={{...inp,resize:'vertical'}}/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>}

            <div style={{marginTop:14}}>
              {label('Resultados')}
              <textarea value={form.resultados??''} onChange={e=>set('resultados',e.target.value)} placeholder="Vendas geradas, cupom usado, leads, visualizações…" rows={2} style={{...inp,resize:'vertical'}}/>
            </div>
          </div>

          {/* FOLLOWUPS */}
          {!isNovo&&(
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:16}}>
              <div style={{fontSize:12,fontWeight:700,color:C.blueDark,marginBottom:12,...font}}>Histórico de Followups</div>
              {/* novo followup */}
              <div style={{background:'var(--surface-subtle)',borderRadius:C.radius,padding:14,marginBottom:14}}>
                <div style={{display:'grid',gap:8}}>
                  <input value={novaFU.responsavel} onChange={e=>setNovaFU(f=>({...f,responsavel:e.target.value}))} placeholder="Seu nome" style={inp}/>
                  <textarea value={novaFU.nota} onChange={e=>setNovaFU(f=>({...f,nota:e.target.value}))} placeholder="O que foi combinado, resultado da conversa…" rows={2} style={{...inp,resize:'vertical'}}/>
                  <button onClick={addFollowup} disabled={!novaFU.responsavel||!novaFU.nota} style={{padding:'8px 14px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'var(--surface-card)',fontWeight:700,fontSize:12,cursor:'pointer',opacity:(!novaFU.responsavel||!novaFU.nota)?0.5:1,...font}}>
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
export default function Parceiros() {
  const [parceiros,setParceiros] = useState<Parceiro[]>([])
  const [nichos,setNichos]       = useState<Nicho[]>([])
  const [modalidades,setModalidades] = useState<Modalidade[]>([])
  const [loading,setLoading]     = useState(false)
  const [busca,setBusca]         = useState('')
  const [filtroStatus,setFiltroStatus] = useState<string>('Todos')
  const [drawer,setDrawer]       = useState<Parceiro|null|undefined>(undefined) // undefined=fechado, null=novo

  const carregar = useCallback(async()=>{
    setLoading(true)
    const ACORDO_COLS = 'id,id_modalidade,tipo_acordo,valor_acordo,vigencia_inicio,vigencia_fim,detalhe_acordo,mkt_modalidades(nome)'
    const [{data:p},{data:n},{data:m}] = await Promise.all([
      supabase.from('mkt_parceiros').select(`*, mkt_nichos(nome), mkt_parceiro_acordos(${ACORDO_COLS})`).order('criado_em',{ascending:false}),
      supabase.from('mkt_nichos').select('*').order('nome'),
      supabase.from('mkt_modalidades').select('*').order('nome'),
    ])
    if(p) setParceiros(p.map((x:any)=>({
      ...x,
      nicho_nome: x.mkt_nichos?.nome,
      acordos: (x.mkt_parceiro_acordos??[])
        .map((a:any)=>({...a,modalidade_nome:a.mkt_modalidades?.nome}))
        .sort((a:Acordo,b:Acordo)=>a.id-b.id),
    })))
    if(n) setNichos(n)
    if(m) setModalidades(m)
    setLoading(false)
  },[])
  useEffect(()=>{carregar()},[])

  const lista = parceiros.filter(p=>{
    const q=busca.toLowerCase()
    const matchQ=!q||(p.nome.toLowerCase().includes(q)||(p.arroba??'').toLowerCase().includes(q)||(p.nicho_nome??'').toLowerCase().includes(q)
                      ||(p.acordos??[]).some(a=>(a.modalidade_nome??'').toLowerCase().includes(q)))
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
          <button onClick={()=>setDrawer(null)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',borderRadius:C.radius,border:'none',background:C.blueMid,color:'var(--surface-card)',fontWeight:700,fontSize:13,cursor:'pointer',...font}}>
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
        <div style={{display:'inline-flex',background:'var(--surface-sunken)',border:`1px solid ${C.border}`,borderRadius:C.radius,padding:3,gap:2}}>
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
              const st=STATUS_COR[p.status]??{bg:'var(--surface-sunken)',fg:C.hint}
              const fim=fimMaisProximo(p.acordos)
              const vencendo=fim&&new Date(fim)<new Date(Date.now()+30*86400000)&&p.status==='Ativo'
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
                    {p.nicho_nome&&<span style={{background:'var(--indigo-50)',color:C.blueDark,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}>{p.nicho_nome}</span>}
                    {p.seguidores&&<span style={{background:'var(--surface-sunken)',color:C.muted,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}><Users size={10}/> {p.seguidores.toLocaleString('pt-BR')}</span>}
                  </div>
                  {/* um chip por acordo — é o que deixa "Varejo 10% / Atacado 5%" visível sem abrir */}
                  {(p.acordos?.length??0)>0&&(
                    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                      {p.acordos!.map(a=>(
                        <span key={a.id} style={{background:'var(--indigo-50)',color:C.blueDark,fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:20,...font}}>
                          {resumoAcordo(a)}
                        </span>
                      ))}
                    </div>
                  )}
                  {vencendo&&<div style={{fontSize:11,color:C.amber,fontWeight:600,marginBottom:8,...font}}>⚠️ Acordo vence em breve</div>}
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{display:'flex',gap:12}}>
                      {p.contato_whatsapp&&<a href={`https://wa.me/55${p.contato_whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:C.green,display:'flex',alignItems:'center',gap:4,fontSize:12,...font}}>
                        <MessageCircle size={13}/> WhatsApp
                      </a>}
                    </div>
                    <div style={{display:'flex',gap:4}}>
                      {fim&&<span style={{fontSize:11,color:C.hint,...font}}><Calendar size={11}/> até {new Date(fim+'T12:00:00').toLocaleDateString('pt-BR',{month:'short',day:'2-digit'})}</span>}
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
          modalidades={modalidades}
          onNichoCreated={n=>setNichos(ns=>[...ns,n].sort((a,b)=>a.nome.localeCompare(b.nome)))}
          onModalidadeCreated={m=>setModalidades(ms=>[...ms,m].sort((a,b)=>a.nome.localeCompare(b.nome)))}
          onClose={()=>setDrawer(undefined)}
          onSaved={carregar}
        />
      )}
    </div>
  )
}
