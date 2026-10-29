import { useEffect, useState } from 'react'
import type { GameMap, Lineup } from '../domain/types'
import type { LineupService } from '../services/lineupService'
import { Library } from '../features/library/Library'
import { Icon } from '../components/Icon'
import { Admin } from '../features/admin/Admin'

export function App({ service }: { service: LineupService }) {
  const [page, setPage] = useState(window.location.hash === '#admin' ? 'admin' : 'library')
  const [data, setData] = useState<{ maps: GameMap[]; lineups: Lineup[] }>()
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setError(false)
    Promise.all([service.listMaps(controller.signal), service.listLineups(controller.signal)]).then(([maps, lineups]) => {
      if (!controller.signal.aborted) { if (!maps.length) throw new Error('Nenhum mapa disponível'); setData({ maps, lineups }) }
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [service, attempt])
  useEffect(() => { const listener = () => setPage(window.location.hash === '#admin' ? 'admin' : 'library'); window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener) }, [])
  return <>
    <header className="app-header"><a className="brand" href="#biblioteca" aria-label="pcdNades, biblioteca">pcd<span>Nades</span><Icon name="crosshair" size={28} /></a><nav aria-label="Navegação principal"><a href="#biblioteca" aria-current={page === 'library' ? 'page' : undefined}>Biblioteca</a><a href="#admin" aria-current={page === 'admin' ? 'page' : undefined}>Administração</a></nav><span className="header-caption">A biblioteca do time</span></header>
    <main id="conteudo"><div className="demo-banner"><Icon name="info" size={18} /><span><strong>Modo demonstração.</strong> Cadastros temporários e pontos fictícios, sem conexão com servidor. Alterações serão perdidas ao recarregar.</span></div>
      {error ? <div className="empty-state" role="alert"><h1>Não foi possível carregar a biblioteca</h1><p>Tente novamente para continuar.</p><button className="button primary" onClick={() => setAttempt(current => current + 1)}>Tentar novamente</button></div> : !data ? <p className="loading" role="status">Carregando biblioteca…</p> : page === 'library' ? <Library maps={data.maps} lineups={data.lineups} /> : <Admin maps={data.maps} lineups={data.lineups} service={service} onSaved={item => setData(current => current ? { ...current, lineups: current.lineups.some(lineup => lineup.id === item.id) ? current.lineups.map(lineup => lineup.id === item.id ? item : lineup) : [...current.lineups, item] } : current)} onDeleted={id => setData(current => current ? { ...current, lineups: current.lineups.filter(item => item.id !== id) } : current)} />}
    </main><footer className="app-footer"><span>pcdNades <span aria-hidden="true">/</span> Feito para treinar em equipe.</span><span>Prévia de interface · CS2</span></footer>
  </>
}
