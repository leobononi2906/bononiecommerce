import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUmblerVendedores, useCampanhaSubgrupos } from '../hooks/useData'
import { Card, CardTitle, SectionLabel, Badge, Spinner } from '../components/ui'
import { shortName } from '../lib/fmt'
import { Plus, Trash2, Save, RefreshCw } from 'lucide-react'
import type { EcomUmblerVendedor, EcomCampanhaSubgrupo } from '../types'

const INPUT_STYLE: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  fontFamily: 'DM Sans, sans-serif',
  color: 'var(--text-primary)',
  background: 'var(--surface)',
  outline: 'none',
  width: '100%',
}

const BTN = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 'var(--radius)',
  border: `1px solid ${color}`, background: bg,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  color, fontFamily: 'DM Sans, sans-serif',
})

export default function Configuracoes() {
  const { data: umblerVend, loading: lv } = useUmblerVendedores()
  const { data: campSub, loading: lcs } = useCampanhaSubgrupos()

  // --- Vendedores ---
  const [vendForm, setVendForm] = useState({ id_membro_umbler: '', nome_vendedor_erp: '', id_vendedor_erp: '', nome_vendedor_erp_completo: '' })
  const [vendMsg, setVendMsg] = useState('')
  const [vendSaving, setVendSaving] = useState(false)

  async function saveVendedor() {
    if (!vendForm.id_membro_umbler || !vendForm.nome_vendedor_erp || !vendForm.id_vendedor_erp) {
      setVendMsg('Preencha todos os campos obrigatórios.')
      return
    }
    setVendSaving(true)
    const { error } = await supabase.from('ecom_umbler_vendedor').upsert({
      id_membro_umbler: vendForm.id_membro_umbler.trim(),
      nome_vendedor_erp: vendForm.nome_vendedor_erp.trim().toUpperCase(),
      nome_vendedor_erp_completo: vendForm.nome_vendedor_erp_completo.trim() || null,
      id_vendedor_erp: parseInt(vendForm.id_vendedor_erp),
      ativo: true,
      criado_em: new Date().toISOString(),
    })
    setVendSaving(false)
    if (error) setVendMsg('Erro: ' + error.message)
    else { setVendMsg('Vendedor salvo com sucesso!'); setVendForm({ id_membro_umbler: '', nome_vendedor_erp: '', id_vendedor_erp: '', nome_vendedor_erp_completo: '' }) }
  }

  async function toggleVendedor(id: string, ativo: boolean) {
    await supabase.from('ecom_umbler_vendedor').update({ ativo: !ativo }).eq('id_membro_umbler', id)
    window.location.reload()
  }

  async function deleteVendedor(id: string) {
    if (!confirm('Remover este vínculo?')) return
    await supabase.from('ecom_umbler_vendedor').delete().eq('id_membro_umbler', id)
    window.location.reload()
  }

  // --- Campanha × Subgrupo ---
  const [csForm, setCsForm] = useState({ campanha: '', subgrupo_produto: '' })
  const [csMsg, setCsMsg] = useState('')
  const [csSaving, setCsSaving] = useState(false)
  const [campanhasDistinct, setCampanhasDistinct] = useState<string[]>([])

  useEffect(() => {
    supabase.from('ecom_meta_ads').select('campanha').range(0, 9999).then(({ data }) => {
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.campanha as string))].sort()
        setCampanhasDistinct(unique)
      }
    })
  }, [])

  async function saveCampanhaSubgrupo() {
    if (!csForm.campanha || !csForm.subgrupo_produto) {
      setCsMsg('Selecione a campanha e informe o subgrupo.')
      return
    }
    setCsSaving(true)
    const { error } = await supabase.from('ecom_campanha_subgrupo').insert({
      campanha: csForm.campanha,
      subgrupo_produto: csForm.subgrupo_produto.trim().toUpperCase(),
    })
    setCsSaving(false)
    if (error) setCsMsg('Erro: ' + error.message)
    else { setCsMsg('Vínculo salvo!'); setCsForm({ campanha: '', subgrupo_produto: '' }) }
  }

  async function deleteCampanhaSubgrupo(id: number) {
    if (!confirm('Remover este vínculo?')) return
    await supabase.from('ecom_campanha_subgrupo').delete().eq('id', id)
    window.location.reload()
  }

  // --- Metas (localStorage) ---
  const [metas, setMetas] = useState(() => {
    try { return JSON.parse(localStorage.getItem('stonni_metas') || '{}') } catch { return {} }
  })
  const [metasMsg, setMetasMsg] = useState('')

  function saveMetas() {
    localStorage.setItem('stonni_metas', JSON.stringify(metas))
    setMetasMsg('Metas salvas!')
    setTimeout(() => setMetasMsg(''), 2000)
  }

  // --- Período padrão ---
  const [periodoDefault, setPeriodoDefault] = useState(
    () => localStorage.getItem('stonni_periodo_default') || 'mes_atual'
  )

  function savePeriodo(v: string) {
    setPeriodoDefault(v)
    localStorage.setItem('stonni_periodo_default', v)
  }

  const PERIODOS = [
    { value: 'mes_atual', label: 'Mês atual' },
    { value: 'mes_anterior', label: 'Mês anterior' },
    { value: '3_meses', label: 'Últimos 3 meses' },
    { value: '6_meses', label: 'Últimos 6 meses' },
  ]

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Configurações</h1>

      {/* ===== VENDEDORES ===== */}
      <SectionLabel>Vendedores — vínculo Umbler ↔ ERP</SectionLabel>
      <Card style={{ marginBottom: 20 }}>
        <CardTitle>Cadastrar novo vínculo</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>ID Membro Umbler *</label>
            <input style={INPUT_STYLE} placeholder="Ex: aW-xxzMMYu2X_QhY" value={vendForm.id_membro_umbler} onChange={e => setVendForm(f => ({ ...f, id_membro_umbler: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>Nome (display) *</label>
            <input style={INPUT_STYLE} placeholder="Ex: FELIPE" value={vendForm.nome_vendedor_erp} onChange={e => setVendForm(f => ({ ...f, nome_vendedor_erp: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>ID Vendedor ERP *</label>
            <input style={INPUT_STYLE} placeholder="Ex: 55351" type="number" value={vendForm.id_vendedor_erp} onChange={e => setVendForm(f => ({ ...f, id_vendedor_erp: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>Nome completo ERP</label>
            <input style={INPUT_STYLE} placeholder="Nome completo (opcional)" value={vendForm.nome_vendedor_erp_completo} onChange={e => setVendForm(f => ({ ...f, nome_vendedor_erp_completo: e.target.value }))} />
          </div>
        </div>
        {vendMsg && <div style={{ fontSize: 12, color: vendMsg.includes('Erro') ? 'var(--red)' : 'var(--green)', marginBottom: 8 }}>{vendMsg}</div>}
        <button style={BTN('var(--blue-dark)', '#EFF6FF')} onClick={saveVendedor} disabled={vendSaving}>
          <Plus size={13} />{vendSaving ? 'Salvando…' : 'Adicionar vínculo'}
        </button>
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <CardTitle>Vínculos cadastrados</CardTitle>
        {lv ? <Spinner /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['ID Umbler','Nome ERP','ID ERP','Nome completo','Status','Ações'].map((h,i) => (
                  <th key={i} style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {umblerVend?.map((v, i) => (
                <tr key={i} style={{ borderBottom: i < (umblerVend.length-1) ? '1px solid var(--border)' : 'none', opacity: v.ativo ? 1 : 0.5 }}>
                  <td style={{ padding: '7px 8px', fontFamily: 'DM Mono', fontSize: 11, color: 'var(--text-muted)' }}>{v.id_membro_umbler}</td>
                  <td style={{ padding: '7px 8px', fontWeight: 500 }}>{v.nome_vendedor_erp}</td>
                  <td style={{ padding: '7px 8px', fontFamily: 'DM Mono' }}>{v.id_vendedor_erp}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)' }}>{v.nome_vendedor_erp_completo || '–'}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <Badge value={v.ativo ? 'Ativo' : 'Inativo'} type={v.ativo ? 'ok' : 'neutral'} />
                  </td>
                  <td style={{ padding: '7px 8px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={BTN(v.ativo ? 'var(--amber)' : 'var(--green)', v.ativo ? 'var(--amber-bg)' : 'var(--green-bg)')} onClick={() => toggleVendedor(v.id_membro_umbler, v.ativo)}>
                        {v.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button style={BTN('var(--red)', 'var(--red-bg)')} onClick={() => deleteVendedor(v.id_membro_umbler)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ===== CAMPANHA × SUBGRUPO ===== */}
      <SectionLabel>Campanhas × Produtos — comparativo</SectionLabel>
      <Card style={{ marginBottom: 20 }}>
        <CardTitle>Vincular campanha a subgrupo de produto</CardTitle>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
          Associe uma campanha Meta Ads a um subgrupo de produto. Isso permite comparar automaticamente os produtos mais vendidos com cada campanha ativa na aba Campanhas.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>Campanha *</label>
            <select style={{ ...INPUT_STYLE }} value={csForm.campanha} onChange={e => setCsForm(f => ({ ...f, campanha: e.target.value }))}>
              <option value="">Selecione a campanha…</option>
              {campanhasDistinct.map(c => (
                <option key={c} value={c}>{c.length > 60 ? c.slice(0,60)+'…' : c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>Subgrupo de produto *</label>
            <input style={INPUT_STYLE} placeholder="Ex: GERADOR, RELÓGIO, PULSEIRA" value={csForm.subgrupo_produto} onChange={e => setCsForm(f => ({ ...f, subgrupo_produto: e.target.value }))} />
          </div>
          <div>
            <button style={BTN('var(--blue-dark)', '#EFF6FF')} onClick={saveCampanhaSubgrupo} disabled={csSaving}>
              <Plus size={13} />{csSaving ? 'Salvando…' : 'Vincular'}
            </button>
          </div>
        </div>
        {csMsg && <div style={{ fontSize: 12, color: csMsg.includes('Erro') ? 'var(--red)' : 'var(--green)', marginTop: 8 }}>{csMsg}</div>}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <CardTitle>Vínculos campanha × produto cadastrados</CardTitle>
        {lcs ? <Spinner /> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                {['Campanha','Subgrupo','Criado em',''].map((h,i) => (
                  <th key={i} style={{ textAlign: i<2?'left':'right', padding: '4px 8px', fontSize: 11, color: 'var(--text-hint)', fontWeight: 600, borderBottom: '1px solid var(--border)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campSub?.map((cs, i) => (
                <tr key={i} style={{ borderBottom: i < (campSub.length-1) ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '7px 8px', maxWidth: 300 }}>
                    <span style={{ fontSize: 11 }}>{cs.campanha.length > 55 ? cs.campanha.slice(0,55)+'…' : cs.campanha}</span>
                  </td>
                  <td style={{ padding: '7px 8px' }}><Badge value={cs.subgrupo_produto} type="info" /></td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--text-hint)', fontSize: 11 }}>{new Date(cs.created_at).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                    <button style={BTN('var(--red)', 'var(--red-bg)')} onClick={() => deleteCampanhaSubgrupo(cs.id)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* ===== METAS ===== */}
      <SectionLabel>Metas — defina seus objetivos</SectionLabel>
      <Card style={{ marginBottom: 24 }}>
        <CardTitle>Metas do dashboard</CardTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          {[
            { key: 'fat_mensal', label: 'Meta faturamento mensal (R$)', placeholder: '500000' },
            { key: 'roas_meta', label: 'Meta de ROAS', placeholder: '40' },
            { key: 'conversao_meta', label: 'Meta de conversão (%)', placeholder: '25' },
            { key: 'ticket_meta', label: 'Meta de ticket médio (R$)', placeholder: '5000' },
            { key: 'cpl_meta', label: 'Meta CPL máximo (R$)', placeholder: '20' },
            { key: 'tempo_resposta_meta', label: 'Meta tempo resposta (min)', placeholder: '15' },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--text-hint)', display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                style={INPUT_STYLE}
                type="number"
                placeholder={placeholder}
                value={metas[key] || ''}
                onChange={e => setMetas((m: any) => ({ ...m, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        {metasMsg && <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>{metasMsg}</div>}
        <button style={BTN('var(--blue-dark)', '#EFF6FF')} onClick={saveMetas}>
          <Save size={13} /> Salvar metas
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-hint)', marginLeft: 8 }}>Salvo localmente no seu navegador</span>
      </Card>

      {/* ===== PERÍODO PADRÃO ===== */}
      <SectionLabel>Período padrão ao abrir o dashboard</SectionLabel>
      <Card>
        <CardTitle>Filtro de período inicial</CardTitle>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PERIODOS.map(p => (
            <button
              key={p.value}
              onClick={() => savePeriodo(p.value)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius)',
                border: `1px solid ${periodoDefault === p.value ? 'var(--blue-dark)' : 'var(--border)'}`,
                background: periodoDefault === p.value ? 'var(--blue-dark)' : 'transparent',
                color: periodoDefault === p.value ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: 500, cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 8 }}>Atual: <strong>{PERIODOS.find(p => p.value === periodoDefault)?.label}</strong></div>
      </Card>
    </div>
  )
}
