import { useState } from 'react'
import type { GameMap, Lineup, Target } from '../domain/types'
import { typeLabels } from '../domain/types'
import { pointFromImage } from '../domain/lineups'
import { Icon } from './Icon'

type Props = { map: GameMap; lineups?: Lineup[]; selectedId?: string; onSelect?: (ids: string[]) => void; target?: Target | null; onTargetChange?: (point: Target) => void }

export function Radar({ map, lineups = [], selectedId, onSelect, target, onTargetChange }: Props) {
  const [broken, setBroken] = useState<string | null>(null)
  const groups = new Map<string, Lineup[]>()
  lineups.forEach(item => {
    const key = `${item.target.x}:${item.target.y}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  })
  return <>
    <div className={`radar-frame ${onTargetChange ? 'radar-edit' : ''}`}>
      {broken === map.radarUrl ? <div className="empty-state" role="alert"><Icon name="info" /><h3>Radar indisponível</h3><p>Não foi possível carregar a imagem. Recarregue a página para tentar novamente.</p></div> : <div className="radar-image">
        <img src={map.radarUrl} width={map.width} height={map.height} alt={`Radar ${map.illustrative ? 'ilustrativo' : 'do mapa'} ${map.name}`} draggable={false} onError={() => setBroken(map.radarUrl)} onClick={onTargetChange ? event => {
          const point = pointFromImage(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect())
          if (point) onTargetChange(point)
        } : undefined} />
        {[...groups.entries()].map(([key, items]) => <button key={key} className={`radar-marker ${items[0].type} ${items.some(item => item.id === selectedId) ? 'selected' : ''}`} style={{ left: `${items[0].target.x * 100}%`, top: `${items[0].target.y * 100}%` }} aria-label={items.length > 1 ? `${items.length} granadas neste destino` : `${items[0].title}, ${typeLabels[items[0].type]}, lado ${items[0].side}`} onClick={() => onSelect?.(items.map(item => item.id))}>
          <span className="marker-face"><Icon name={items[0].type} size={16} />{items.length > 1 && <span className="marker-count">{items.length}</span>}</span>
        </button>)}
        {target && <div className="target-marker" style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }} aria-hidden="true"><Icon name="crosshair" size={32} /></div>}
      </div>}
    </div>
    <p className="radar-caption"><Icon name="info" size={16} /><span>{map.illustrative ? 'Radar ilustrativo. Não representa o mapa real; não usar para treinar.' : 'Os pontos desta demonstração são fictícios.'}{map.credit && <> <a href={map.credit.url} target="_blank" rel="noreferrer">{map.credit.label}</a> · <a href="/maps/ATTRIBUTION.md" target="_blank" rel="noreferrer">Créditos e licença</a>.</>}{map.note && <span className="radar-version">{map.note}</span>}</span></p>
  </>
}
