import { Routes, Route } from 'react-router'
import AppShell from './components/layout/AppShell'
import HomePg from './pages/Home'
import Atendimento from './pages/Atendimento'
import Campanhas from './pages/Campanhas'
import Parceiros from './pages/Parceiros'
import Marketplace from './pages/Marketplace'
import Vendedores from './pages/Vendedores'
import Relatorios from './pages/Relatorios'
import Configuracoes from './pages/Configuracoes'
import ConferenciaBling from './pages/ConferenciaBling'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePg />} />
        <Route path="atendimento" element={<Atendimento />} />
        <Route path="campanhas" element={<Campanhas />} />
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
