import React, { useMemo, useState } from 'react'
import { Card, CardTitle, Spinner, Badge, AlertBanner } from '../ui'
import {
  useFunilAtendimento, useConfigEtiquetas, salvarPadraoEtiqueta,
  leadCasa, candidatosEtiqueta,
} from '../../hooks/use-funil'
import type { ConfigEtiqueta } from '../../hooks/use-funil'
import { useUmblerVendedores, useInternos } from '../../hooks/use-vendedores'
import { fmtNum, shortName } from '../../lib/fmt'
import type { Periodo } from '../../types'

const SEM_ATENDENTE = '(sem atendente)'

interface Linha {
  vendedor: string
  atendimentos: number
  porColuna: Record<string, number>
  vendas: number
  interessados: number
}

function pct(n: number, d: number): string {
  if (!d) return '—'
  return (n / d * 100).toFixed(1).replace('.', ',') + '%'
}

export default function FunilVendedores({ periodo }: { periodo: Periodo }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [salvando, setSalvando] = useState<number | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const [ocultarSemVinculo, setOcultarSemVinculo] = useState<boolean>(
    () => localStorage.getItem('ecom_atd_ocultar_sem_vinculo') !== 'false',  // padrão: ocultar
  )
  function toggleOcultar() {
    setOcultarSemVinculo(v => { const n = !v; localStorage.setItem('ecom_atd_ocultar_sem_vinculo', String(n)); return n })
  }

  const { data: leads, loading: lLeads, error: eLeads } = useFunilAtendimento(periodo)
  const { data: config, loading: lCfg } = useConfigEtiquetas(refreshKey)
  const { data: umblerVend } = useUmblerVendedores()
  const { data: internos } = useInternos()

  const idToName = useMemo(() => {
    const m: Record<string, string> = {}
    umblerVend?.forEach(v => { m[v.id_membro_umbler] = shortName(v.nome_vendedor_erp) })
    return m
  }, [umblerVend])

  const setInternos = useMemo(() => internos ?? new Set<string>(), [internos])

  const cfgInteressado = useMemo<ConfigEtiqueta | undefined>(
    () => (config || []).find(c => c.coluna_key === 'interessado'),
    [config],
  )

  const linhas = useMemo<Linha[]>(() => {
    if (!leads || !config) return []
    const map = new Map<string, Linha>()
    leads.forEach(l => {
      const id = l.id_membro_umbler
      if (id && setInternos.has(id)) return
      const nome = id ? (idToName[id] || id) : SEM_ATENDENTE
      let linha = map.get(nome)
      if (!linha) {
        linha = { vendedor: nome, atendimentos: 0, porColuna: {}, vendas: 0, interessados: 0 }
        config.forEach(c => { linha!.porColuna[c.coluna_key] = 0 })
        map.set(nome, linha)
      }
      linha.atendimentos++
      if (l.comprou_erp) linha.vendas++
      config.forEach(c => {
        if (leadCasa(l.tags, c)) linha!.porColuna[c.coluna_key]++
      })
      if (cfgInteressado && leadCasa(l.tags, cfgInteressado)) linha.interessados++
    })
    return [...map.values()].sort((a, b) => b.atendimentos - a.atendimentos)
  }, [leads, config, idToName, setInternos, cfgInteressado])

  // Nomes com vínculo ERP (resolvidos via ecom_umbler_vendedor)
  const nomesComVinculo = useMemo(() => new Set(Object.values(idToName)), [idToName])
  // Linhas visíveis: opcionalmente esconde quem não tem vínculo (IDs crus + "(sem atendente)")
  const linhasVis = useMemo(
    () => ocultarSemVinculo ? linhas.filter(l => nomesComVinculo.has(l.vendedor)) : linhas,
    [linhas, ocultarSemVinculo, nomesComVinculo],
  )

  const semEtiqueta = useMemo(() => {
    if (!leads || !config) return new Map<string, number>()
    const funil = config.filter(c => c.conta_funil)
    const m = new Map<string, number>()
    leads.forEach(l => {
      const id = l.id_membro_umbler
      if (id && setInternos.has(id)) return
      const nome = id ? (idToName[id] || id) : SEM_ATENDENTE
      const temEtapa = funil.some(c => leadCasa(l.tags, c))
      if (!temEtapa) m.set(nome, (m.get(nome) || 0) + 1)
    })
    return m
  }, [leads, config, idToName, setInternos])

  const opcoes = useMemo(() => candidatosEtiqueta(leads), [leads])

  const totais = useMemo(() => {
    const t: Linha = { vendedor: 'TOTAL', atendimentos: 0, porColuna: {}, vendas: 0, interessados: 0 }
    ;(config || []).forEach(c => { t.porColuna[c.coluna_key] = 0 })
    linhasVis.forEach(l => {
      t.atendimentos += l.atendimentos
      t.vendas += l.vendas
      t.interessados += l.interessados
      ;(config || []).forEach(c => { t.porColuna[c.coluna_key] += l.porColuna[c.coluna_key] || 0 })
    })
    return t
  }, [linhasVis, config])

  const totalSemEtiqueta = useMemo(() => {
    const visiveis = new Set(linhasVis.map(l => l.vendedor))
    let s = 0
    semEtiqueta.forEach((v, nome) => { if (visiveis.has(nome)) s += v })
    return s
  }, [semEtiqueta, linhasVis])

  async function mudarPadrao(cfg: ConfigEtiqueta, valor: string) {
    if (!valor) return
    setSalvando(cfg.id); setErroSalvar(null)
    try {
      await salvarPadraoEtiqueta(cfg.id, valor)
      setRefreshKey(k => k + 1)
    } catch (e) {
      setErroSalvar(`Não foi possível salvar a etiqueta da coluna "${cfg.label}".`)
    } finally {
      setSalvando(null)
    }
  }

  if (lLeads || lCfg) {
    return <Card><CardTitle>Funil por vendedor</CardTitle><Spinner /></Card>
  }
  if (eLeads) {
    return (
      <Card>
        <CardTitle>Funil por vendedor</CardTitle>
        <AlertBanner type="error">Falha ao carregar o funil de atendimento.</AlertBanner>
      </Card>
    )
  }

  const cfgs = config || []

  const th: React.CSSProperties = {
    padding: '6px 8px', fontSize: 10.5, fontWeight: 600, color: 'var(--text-hint)',
    textTransform: 'uppercase', letterSpacing: '0.04em',
    borderBottom: '1px solid var(--border)', textAlign: 'right', verticalAlign: 'bottom',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '8px', textAlign: 'right', fontFamily: 'DM Mono, monospace',
    fontSize: 12.5, whiteSpace: 'nowrap',
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <CardTitle>
          Funil por vendedor{' '}
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-hint)' }}>
            — contatos que entraram no período, cruzados com a venda faturada no ERP
          </span>
        </CardTitle>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={ocultarSemVinculo} onChange={toggleOcultar} />
          Ocultar sem vínculo ERP
        </label>
      </div>

      {erroSalvar && <div style={{ marginBottom: 10 }}><AlertBanner type="error">{erroSalvar}</AlertBanner></div>}

      {linhasVis.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Nenhum atendimento no período selecionado.
        </div>
      ) : (
        <div className="ecom-scroll-x">
          <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left' }}>Vendedor</th>
                <th style={th}>Atend.</th>
                {cfgs.map(c => (
                  <th key={c.coluna_key} style={th}>
                    <div>{c.label}</div>
                    <select
                      value={c.padroes[0] || ''}
                      disabled={salvando === c.id}
                      onChange={e => mudarPadrao(c, e.target.value)}
                      title="Trocar a etiqueta que alimenta esta coluna"
                      style={{
                        marginTop: 4, maxWidth: 118, width: '100%',
                        fontSize: 10, fontFamily: 'DM Sans, sans-serif',
                        color: 'var(--text-muted)', background: 'var(--bg)',
                        border: '1px solid var(--border)', borderRadius: 6,
                        padding: '2px 4px', textTransform: 'none', letterSpacing: 0,
                        cursor: salvando === c.id ? 'wait' : 'pointer',
                      }}
                    >
                      {!opcoes.includes(c.padroes[0] || '') && (
                        <option value={c.padroes[0] || ''}>{c.padroes[0] || '— definir —'}</option>
                      )}
                      {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                ))}
                <th style={th}>Sem etiqueta</th>
                <th style={{ ...th, borderLeft: '1px solid var(--border)' }}>Fechou ERP</th>
                <th style={th}>Conversão</th>
                <th style={th}>Índice fech.</th>
              </tr>
            </thead>
            <tbody>
              {linhasVis.map((l, i) => {
                const se = semEtiqueta.get(l.vendedor) || 0
                const conv = l.atendimentos ? (l.vendas / l.atendimentos) * 100 : 0
                const idx = l.interessados ? (l.vendas / l.interessados) * 100 : 0
                return (
                  <tr key={i} style={{ borderBottom: i < linhasVis.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <td style={{ ...td, textAlign: 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>
                      {l.vendedor}
                    </td>
                    <td style={td}>{fmtNum(l.atendimentos)}</td>
                    {cfgs.map(c => (
                      <td key={c.coluna_key} style={td}>{fmtNum(l.porColuna[c.coluna_key] || 0)}</td>
                    ))}
                    <td style={{ ...td, color: 'var(--text-muted)' }}>{fmtNum(se)}</td>
                    <td style={{ ...td, borderLeft: '1px solid var(--border)', fontWeight: 600 }}>{fmtNum(l.vendas)}</td>
                    <td style={td}>
                      <Badge value={pct(l.vendas, l.atendimentos)} type={conv >= 2 ? 'ok' : conv >= 1 ? 'warn' : 'err'} />
                    </td>
                    <td style={td}>
                      {l.interessados
                        ? <Badge value={pct(l.vendas, l.interessados)} type={idx >= 5 ? 'ok' : idx >= 2 ? 'warn' : 'err'} />
                        : <span style={{ color: 'var(--text-hint)' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#F8FAFC' }}>
                <td style={{ ...td, textAlign: 'left', fontFamily: 'DM Sans, sans-serif', fontWeight: 700 }}>TOTAL</td>
                <td style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.atendimentos)}</td>
                {cfgs.map(c => (
                  <td key={c.coluna_key} style={{ ...td, fontWeight: 700 }}>{fmtNum(totais.porColuna[c.coluna_key] || 0)}</td>
                ))}
                <td style={{ ...td, fontWeight: 700, color: 'var(--text-muted)' }}>{fmtNum(totalSemEtiqueta)}</td>
                <td style={{ ...td, fontWeight: 700, borderLeft: '1px solid var(--border)' }}>{fmtNum(totais.vendas)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pct(totais.vendas, totais.atendimentos)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{pct(totais.vendas, totais.interessados)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10.5, color: 'var(--text-hint)', lineHeight: 1.5 }}>
        O seletor no cabeçalho troca a etiqueta que alimenta a coluna — vale para todo o histórico, sem publicar nada.
        <br />
        <b>Conversão</b> = vendas no ERP ÷ atendimentos. <b>Índice de fechamento</b> = vendas no ERP ÷ interessados.
      </div>
    </Card>
  )
}
