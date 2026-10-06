import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import logoMark from '../assets/stonni-logo-mark.png'

const caixa: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  background: 'var(--bg, #f5f6f8)', fontFamily: 'var(--font-sans)',
}
const cartao: React.CSSProperties = {
  width: '100%', maxWidth: 360, background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 24, boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
}
const campo: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 10px', fontSize: 13, fontFamily: 'var(--font-sans)',
  border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-primary)',
}
const rotulo: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }
const botao: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
  border: 'none', borderRadius: 8, background: 'var(--blue-dark)', color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

function Marca() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <img src={logoMark} alt="Stonni" style={{ width: 28, height: 28, objectFit: 'contain' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--blue-dark)' }}>Stonni</div>
        <div style={{ fontSize: 10, color: 'var(--text-hint)' }}>Ecommerce</div>
      </div>
    </div>
  )
}

/** Login inline — mesmo e-mail e senha do Hub Bononi. */
export function Login() {
  const { hubUrl } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setCarregando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) {
        // 5xx / timeout não é senha errada (apagão do banco de 05/10/2026 respondeu texto puro).
        setErro(error.status && error.status >= 500
          ? 'Sistema instável no momento. Tente de novo em alguns minutos.'
          : 'E-mail ou senha incorretos.')
      }
    } catch {
      setErro('Falha de conexão. Tente de novo.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div style={caixa}>
      <div style={cartao}>
        <Marca />
        <form onSubmit={entrar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={rotulo}>E-mail</label>
            <input style={campo} type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="username" required />
          </div>
          <div>
            <label style={rotulo}>Senha</label>
            <input style={campo} type="password" value={senha} onChange={e => setSenha(e.target.value)}
              autoComplete="current-password" required />
          </div>
          {erro && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--red)', background: 'var(--red-bg)', border: '1px solid var(--red)', borderRadius: 8, padding: '8px 10px' }}>
              {erro}
            </p>
          )}
          <button type="submit" style={{ ...botao, opacity: carregando ? 0.7 : 1 }} disabled={carregando}>
            <style>{'@keyframes ecom-giro { to { transform: rotate(360deg); } }'}</style>
            {carregando && <Loader2 size={14} style={{ animation: 'ecom-giro 0.8s linear infinite' }} />}
            Entrar
          </button>
        </form>
        <p style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 16, textAlign: 'center' }}>
          Mesmo login do{' '}
          <a href={hubUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-dark)' }}>Hub Bononi</a>
        </p>
      </div>
    </div>
  )
}

/** Logado, mas sem o módulo 'ecommerce' liberado. */
export function SemAcesso() {
  const { nome, logout, hubUrl } = useAuth()
  return (
    <div style={caixa}>
      <div style={{ ...cartao, maxWidth: 380, textAlign: 'center' }}>
        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>Sem acesso ao E-commerce</p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          {nome}, seu usuário não tem o módulo <strong>ecommerce</strong> liberado. Peça a um admin para marcar no Hub → Usuários.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <a href={hubUrl} target="_blank" rel="noopener noreferrer"
            style={{ ...botao, background: 'transparent', color: 'var(--blue-dark)', border: '1px solid var(--border)', textDecoration: 'none' }}>
            Ir pro Hub
          </a>
          <button onClick={logout} style={botao}>Sair</button>
        </div>
      </div>
    </div>
  )
}
