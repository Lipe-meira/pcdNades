import { useEffect, useRef, useState } from 'react'
import type { Filters, GameMap, Lineup } from '../../domain/types'
import { typeLabels } from '../../domain/types'
import { filterLineups } from '../../domain/lineups'
import { Radar } from '../../components/Radar'
import { Icon } from '../../components/Icon'
import { VideoPlayer } from './VideoPlayer'

export function Library({ maps, lineups }: { maps: GameMap[]; lineups: Lineup[] }) {
  const [filters, setFilters] = useState<Filters>({ mapId: maps[0].id, type: 'all', side: 'all' })
  const [selectedId, setSelectedId] = useState<string>()
  const [destinationIds, setDestinationIds] = useState<string[] | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const map = maps.find(item => item.id === filters.mapId) ?? maps[0]
  const visible = filterLineups(lineups, filters)
  const selected = visible.find(item => item.id === selectedId)
  const listed = destinationIds ? visible.filter(item => destinationIds.includes(item.id)) : visible
  function updateFilters(change: Partial<Filters>) { setFilters(current => ({ ...current, ...change })); setDestinationIds(null); setSelectedId(undefined) }
  useEffect(() => {
    if (selectedId && heading.current && window.matchMedia('(max-width: 760px)').matches) {
      heading.current.focus({ preventScroll: true })
      heading.current.scrollIntoView({ behavior: 'instant', block: 'start' })
    }
  }, [selectedId])
  return <>
    <div className="page-heading"><div><h1>{map.name}</h1><p>Escolha uma granada. Treine a execução.</p></div><label className="map-select">Mapa<select value={map.id} onChange={event => updateFilters({ mapId: event.target.value })}>{maps.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <div className="library-layout">
      <section className="radar-column" aria-label="Mapa e filtros">
        <div className="filters">
          <div className="filter-group" role="group" aria-label="Tipo de granada">
            {(['all', 'smoke', 'flashbang', 'molotov'] as const).map(type => <button key={type} className={`filter ${filters.type === type ? 'active' : ''}`} aria-pressed={filters.type === type} onClick={() => updateFilters({ type })}>{type !== 'all' && <Icon name={type} size={18} />}{type === 'all' ? 'Todas' : typeLabels[type]}</button>)}
          </div>
          <div className="filter-group side-filters" role="group" aria-label="Lado do time">{(['all', 'T', 'CT'] as const).map(side => <button key={side} className={`filter ${filters.side === side ? 'active' : ''}`} aria-pressed={filters.side === side} onClick={() => updateFilters({ side })}>{side === 'all' ? 'Ambos' : side}</button>)}</div>
        </div>
        <Radar map={map} lineups={visible} selectedId={selected?.id} onSelect={ids => { if (ids.length > 1) { setDestinationIds(ids); setSelectedId(undefined) } else { setSelectedId(ids[0]); setDestinationIds(null) } }} />
        <div className="radar-legend"><span><i className="legend-dot smoke" />Smoke</span><span><i className="legend-dot flashbang" />Flashbang</span><span><i className="legend-dot molotov" />Molotov</span><span className="legend-hint">Selecione um ponto ou use a lista ao lado.</span></div>
      </section>
      <aside className="lineup-rail" aria-label="Biblioteca de granadas">
        <div className="section-heading"><h2>{destinationIds ? 'Neste destino' : 'Granadas'} <span className="count">{listed.length}</span></h2>{destinationIds && <button className="text-button" onClick={() => setDestinationIds(null)}>Ver todas</button>}</div>
        <div className="lineup-list">{listed.map(item => <button key={item.id} className={`lineup-row ${selected?.id === item.id ? 'selected' : ''}`} aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}><span className={`type-icon ${item.type}`}><Icon name={item.type} /></span><span className="row-content"><strong>{item.title}</strong><span>{typeLabels[item.type]} <span aria-hidden="true">·</span> Lado {item.side}</span></span><Icon name="arrow" size={17} /></button>)}</div>
        {listed.length === 0 && <div className="empty-state"><Icon name="crosshair" size={32} /><h3>Nenhuma granada por aqui</h3><p>{filters.type === 'all' && filters.side === 'all' ? 'Este mapa ainda não tem exemplos. Escolha outro mapa para explorar a demonstração.' : 'Experimente outro tipo ou lado para encontrar uma granada.'}</p>{(filters.type !== 'all' || filters.side !== 'all') && <button className="button secondary" onClick={() => updateFilters({ type: 'all', side: 'all' })}>Limpar filtros</button>}</div>}
        {selected ? <section className="lineup-detail" aria-label="Detalhes da granada"><div className="section-heading"><h2 ref={heading} tabIndex={-1}>{selected.title}</h2><button className="icon-button" onClick={() => setSelectedId(undefined)} aria-label="Fechar detalhes"><Icon name="close" /></button></div><div className="detail-meta"><span className={`type-text ${selected.type}`}><Icon name={selected.type} size={16} />{typeLabels[selected.type]}</span><span>Lado {selected.side}</span></div><VideoPlayer video={selected.video} /><h3>Instruções</h3><p className="instructions">{selected.instructions}</p><p className="detail-note">Exemplo temporário da interface.</p></section> : listed.length > 0 && <div className="selection-hint"><Icon name="crosshair" size={30} /><h3>{destinationIds ? 'Mais de uma granada neste ponto' : 'Encontre sua próxima lineup'}</h3><p>{destinationIds ? 'Escolha uma das granadas da lista para abrir os detalhes.' : 'Selecione um destino no radar ou uma granada na lista para ver o vídeo e as instruções.'}</p></div>}
      </aside>
    </div>
  </>
}
