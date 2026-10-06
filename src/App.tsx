import { Routes, Route } from 'react-router'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { Login, SemAcesso } from './components/Login'
import AppShell from './components/layout/AppShell'
import HomePg from './pages/Home'
import Atendimento from './pages/Atendimento'
import Campanhas from './pages/Campanhas'
import CampanhasRoi from './pages/CampanhasRoi'
import Parceiros from './pages/Parceiros'
import Marketplace from './pages/Marketplace'
import Vendedores from './pages/Vendedores'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import ConferenciaBling from './pages/ConferenciaBling'

function Rotas() {
  const { session, carregando, temAcesso } = useAuth()

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Sem Tailwind neste app: a animação é inline (keyframes junto). */}
        <style>{'@keyframes ecom-giro { to { transform: rotate(360deg); } }'}</style>
        <Loader2 size={24} style={{ color: 'var(--blue-dark)', animation: 'ecom-giro 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!session) return <Login />
  if (!temAcesso) return <SemAcesso />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePg />} />
        <Route path="atendimento" element={<Atendimento />} />
        <Route path="campanhas" element={<Campanhas />} />
        <Route path="campanhas-roi" element={<CampanhasRoi />} />
        <Route path="parceiros" element={<Parceiros />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="vendedores" element={<Vendedores />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="conferencia" element={<ConferenciaBling />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Rotas />
    </AuthProvider>
  )
}
