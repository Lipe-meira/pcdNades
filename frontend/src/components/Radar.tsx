import { useEffect, useRef, useState } from "react";
import type { GameMap, Lineup, Target, GrenadeType } from "../domain/types";
import { typeLabels } from "../domain/types";
import { isTarget, pointFromImage } from "../domain/lineups";
import { Icon } from "./Icon";

type Props = {
  map: GameMap;
  lineups?: Lineup[];
  selectedId?: string;
  onSelect?: (ids: string[]) => void;
  target?: Target | null;
  extraTargets?: Target[] | null;
  origin?: Target | null;
  marking?: "origin" | "target" | "idle";
  selectedTargetIndex?: number;
  onEditOrigin?: () => void;
  onEditTarget?: (index: number) => void;
  onOriginChange?: (point: Target) => void;
  highlightedIds?: string[];
  onTargetChange?: (point: Target) => void;
  demo?: boolean;
};

export function Radar({
  map,
  lineups = [],
  selectedId,
  onSelect,
  target,
  extraTargets,
  origin,
  marking = "target",
  selectedTargetIndex = 0,
  onEditOrigin,
  onEditTarget,
  onOriginChange,
  highlightedIds = [],
  onTargetChange,
  demo = true,
}: Props) {
  const [broken, setBroken] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!expanded) return;
    toggle.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setExpanded(false); toggle.current?.focus(); }
      if (event.key === "Tab") {
        const controls = [...(shell.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]") ?? [])];
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", close, true);
    return () => window.removeEventListener("keydown", close, true);
  }, [expanded]);
  const editing = Boolean(onOriginChange || onTargetChange);
  const changePoint = marking === "origin" ? onOriginChange : marking === "target" ? onTargetChange : undefined;
  const origins = lineups.filter((item) => item.origin && isTarget(item.origin) &&
    (selectedId ? item.id === selectedId : highlightedIds.includes(item.id)));
  const connections = editing
    ? origin && isTarget(origin) ? (extraTargets?.length ? extraTargets : target ? [target] : []).filter(isTarget).map((point, i) => ({ id: `draft-${i}`, origin, target: point })) : []
    : origins.flatMap(item => (item.destinations?.length ? item.destinations : [item.target]).map((point,i) => ({ id: `${item.id}-${i}`, origin: item.origin!, target: point })));
  const groups = new Map<string, { item: Lineup; target: Target; markerType: GrenadeType; targetIndex: number }[]>();
  lineups.forEach(item => (item.destinations?.length ? item.destinations : [item.target]).forEach((target, targetIndex) => {
    const key = `${target.x}:${target.y}`;
    const markerType = "type" in target && (target.type === "smoke" || target.type === "flashbang" || target.type === "molotov") ? target.type : item.type;
    groups.set(key, [...(groups.get(key) ?? []), { item, target, markerType, targetIndex }]);
  }));
  return (
    <>
      <div ref={shell} className={`radar-shell ${expanded ? "radar-shell-expanded" : ""}`}
        role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined}
        aria-label={expanded ? `Radar ampliado: ${map.name}` : undefined}>
      <div className="radar-toolbar">
        <span>{map.name} <span className="radar-toolbar-label">· radar</span></span>
        <button ref={toggle} type="button" className="button secondary radar-expand" aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}>{expanded ? "Reduzir radar" : "Ampliar radar"}</button>
      </div>
      <div className={`radar-frame ${editing ? "radar-edit" : ""}`}>
        {broken === map.radarUrl ? (
          <div className="empty-state" role="alert">
            <Icon name="info" />
            <h3>Radar indisponível</h3>
            <p>
              Não foi possível carregar a imagem. Recarregue a página para
              tentar novamente.
            </p>
          </div>
        ) : (
          <div className="radar-image">
            <img
              src={map.radarUrl}
              width={map.width}
              height={map.height}
              alt={`Radar ${map.illustrative ? "ilustrativo" : "do mapa"} ${map.name}`}
              draggable={false}
              onError={() => setBroken(map.radarUrl)}
              onClick={
                changePoint
                  ? (event) => {
                      const point = pointFromImage(
                        event.clientX,
                        event.clientY,
                        event.currentTarget.getBoundingClientRect(),
                      );
                      if (point) changePoint(point);
                    }
                  : undefined
              }
            />
            {connections.length > 0 && <svg className="origin-connections" viewBox="0 0 100 100"
              preserveAspectRatio="none" aria-hidden="true">
              {connections.map((item) => <line key={item.id}
                x1={item.origin.x * 100} y1={item.origin.y * 100}
                x2={item.target.x * 100} y2={item.target.y * 100} />)}
            </svg>}
            {origins.map((item) => <button key={`origin-${item.id}`} type="button"
              className="origin-marker" aria-label={`Origem de ${item.title}`}
              aria-pressed={item.id === selectedId}
              style={{ left: `${item.origin!.x * 100}%`, top: `${item.origin!.y * 100}%` }}
              onClick={() => { onSelect?.([item.id]); setExpanded(false); }}>
              <Icon name="plus" size={17} />
            </button>)}
            {editing && origin && isTarget(origin) && <button type="button" className="origin-marker origin-draft"
              aria-label="Selecionar origem para reposicionar" aria-pressed={marking === "origin"} onClick={onEditOrigin}
              style={{ left: `${origin.x * 100}%`, top: `${origin.y * 100}%` }}>
              <Icon name="plus" size={17} />
            </button>}
            {[...groups.entries()].map(([key, items]) => (
              <button
                key={key}
                className={`radar-marker ${items[0].markerType} ${items.some((item) => item.item.id === selectedId) ? "selected" : ""}`}
                style={{
                  left: `${items[0].target.x * 100}%`,
                  top: `${items[0].target.y * 100}%`,
                }}
                aria-label={
                  items.length > 1
                    ? `${items.length} granadas neste destino`
                    : items[0].item.destinations?.length
                      ? `${items[0].item.title}, Solo Exec, destino ${items[0].targetIndex + 1}, ${typeLabels[items[0].markerType]}, lado ${items[0].item.side}`
                      : `${items[0].item.title}, ${typeLabels[items[0].item.type]}, lado ${items[0].item.side}`
                }
                onClick={() => { onSelect?.([...new Set(items.map(({ item }) => item.id))]); setExpanded(false); }}
              >
                <span className="marker-face">
                  <Icon name={items[0].markerType} size={16} />
                  {items.length === 1 && items[0].item.destinations?.length && (
                    <span className="draft-number">{items[0].targetIndex + 1}</span>
                  )}
                  {items.length > 1 && (
                    <span className="marker-count">{items.length}</span>
                  )}
                </span>
              </button>
            ))}
            {extraTargets?.map((point,index) => isTarget(point) && <button type="button" key={`extra-${index}`} className={`target-marker draft-target ${index === selectedTargetIndex ? "selected" : ""}`} style={{left:`${point.x * 100}%`,top:`${point.y * 100}%`}} aria-label={`Selecionar destino ${index + 1} para reposicionar`} aria-pressed={marking === "target" && index === selectedTargetIndex} onClick={() => onEditTarget?.(index)}><Icon name={"type" in point ? (point.type as "smoke" | "flashbang" | "molotov") : "crosshair"} size={17} /><span className="draft-number">{index + 1}</span></button>)}
            {target && !extraTargets?.length && (
              <button type="button"
                className="target-marker draft-target selected"
                style={{
                  left: `${target.x * 100}%`,
                  top: `${target.y * 100}%`,
                }}
                aria-label="Selecionar destino para reposicionar"
                aria-pressed={marking === "target"}
                onClick={() => onEditTarget?.(0)}
              >
                <Icon name="crosshair" size={20} />
              </button>
            )}
          </div>
        )}
      </div>
      </div>
      <p className="radar-caption">
        <Icon name="info" size={16} />
        <span>
          {map.illustrative
            ? "Radar ilustrativo. Não representa o mapa real; não usar para treinar."
            : demo
              ? "Os pontos desta demonstração são fictícios."
              : "Os pontos indicam o destino das granadas cadastradas."}
          {map.credit && (
            <>
              {" "}
              <a href={map.credit.url} target="_blank" rel="noreferrer">
                {map.credit.label}
              </a>{" "}
              ·{" "}
              <a href="/maps/ATTRIBUTION.md" target="_blank" rel="noreferrer">
                Créditos e licença
              </a>
              .
            </>
          )}
          {map.note && <span className="radar-version">{map.note}</span>}
        </span>
      </p>
    </>
  );
}
