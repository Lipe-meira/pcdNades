import { useEffect, useRef, useState } from "react";
import type { GameMap, Lineup, Target, GrenadeType } from "../domain/types";
import { typeLabels, isSingleGrenadeType } from "../domain/types";
import { isTarget, pointFromImage } from "../domain/lineups";
import { levelFor, levelInfo, levelsOf } from "../domain/mapLevels";
import type { MapLevelId } from "../domain/mapLevels";
import { Icon } from "./Icon";

type Props = {
  map: GameMap;
  lineups?: Lineup[];
  selectedId?: string;
  onSelect?: (ids: string[]) => void;
  target?: Target | null;
  extraTargets?: (Target & { level?: MapLevelId | null })[] | null;
  origin?: Target | null;
  marking?: "origin" | "target" | "idle";
  selectedTargetIndex?: number;
  onEditOrigin?: () => void;
  onEditTarget?: (index: number) => void;
  onOriginChange?: (point: Target) => void;
  highlightedIds?: string[];
  onTargetChange?: (point: Target) => void;
  demo?: boolean;
  /** Andar exibido (mapas com andares). Controlado por quem usa o radar; sem ele os botões não aparecem. */
  level?: MapLevelId;
  onLevelChange?: (level: MapLevelId) => void;
  /** Andar dos pontos do rascunho no editor. */
  originLevel?: MapLevelId | null;
  targetLevel?: MapLevelId | null;
  /** Texto acessível do grupo de botões de andar (ex.: "Andar da origem" no editor). */
  levelGroupLabel?: string;
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
  level,
  onLevelChange,
  originLevel,
  targetLevel,
  levelGroupLabel = "Andar do radar",
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
  const leveled = levelsOf(map.id);
  const activeLevel = leveled && level !== undefined ? levelFor(map.id, level) : leveled ? leveled.defaultLevel : undefined;
  const activeInfo = leveled ? levelInfo(map.id, activeLevel) : undefined;
  const radarUrl = activeInfo?.radarUrl ?? map.radarUrl;
  // Em mapas sem andares todo ponto é exibido; nos demais, só os do andar em exibição.
  const onLevel = (pointLevel?: MapLevelId | null) => !leveled || levelFor(map.id, pointLevel) === activeLevel;
  const destinationLevel = (item: Lineup, point: Target) => ("level" in point && (point as { level?: MapLevelId | null }).level) || item.targetLevel;
  const levelOfPoints = (item: Lineup) => [
    ...(item.origin ? [item.originLevel] : []),
    ...(item.destinations?.length ? item.destinations.map(point => point.level ?? item.targetLevel) : [item.targetLevel]),
  ];
  const changePoint = marking === "origin" ? onOriginChange : marking === "target" ? onTargetChange : undefined;
  const focused = lineups.filter((item) => (selectedId ? item.id === selectedId : highlightedIds.includes(item.id)));
  const origins = focused.filter((item) => item.origin && isTarget(item.origin) && onLevel(item.originLevel));
  // Andares dos pontos de granadas em foco que não estão na tela agora (ex.: origem em um andar, destino em outro).
  const otherLevels = leveled && !editing
    ? [...new Set(focused.flatMap(levelOfPoints).map(value => levelFor(map.id, value)))].filter(value => value !== activeLevel) as MapLevelId[]
    : [];
  const draftExtras = extraTargets?.filter(point => isTarget(point)) ?? [];
  const draftOtherLevels = leveled && editing
    ? [...new Set([
        ...(origin && isTarget(origin) ? [levelFor(map.id, originLevel)] : []),
        ...(draftExtras.length ? draftExtras.map(point => levelFor(map.id, point.level)) : target ? [levelFor(map.id, targetLevel)] : []),
      ])].filter(value => value !== activeLevel) as MapLevelId[]
    : [];
  const hiddenLevels = editing ? draftOtherLevels : otherLevels;
  const connections = editing
    ? origin && isTarget(origin) && onLevel(originLevel)
      ? (extraTargets?.length ? extraTargets : target ? [{ ...target, level: targetLevel }] : []).filter(isTarget).filter(point => onLevel((point as { level?: MapLevelId | null }).level)).map((point, i) => ({ id: `draft-${i}`, origin, target: point }))
      : []
    : origins.flatMap(item => (item.destinations?.length ? item.destinations : [item.target])
        .filter(point => onLevel(destinationLevel(item, point)))
        .map((point,i) => ({ id: `${item.id}-${i}`, origin: item.origin!, target: point })));
  const groups = new Map<string, { item: Lineup; target: Target; markerType: GrenadeType; targetIndex: number }[]>();
  lineups.forEach(item => (item.destinations?.length ? item.destinations : [item.target]).forEach((target, targetIndex) => {
    if (!onLevel(destinationLevel(item, target))) return;
    const key = `${target.x}:${target.y}`;
    const markerType = "type" in target && isSingleGrenadeType(target.type) ? target.type : item.type;
    groups.set(key, [...(groups.get(key) ?? []), { item, target, markerType, targetIndex }]);
  }));
  return (
    <>
      <div ref={shell} className={`radar-shell ${expanded ? "radar-shell-expanded" : ""}`}
        role={expanded ? "dialog" : undefined} aria-modal={expanded ? true : undefined}
        aria-label={expanded ? `Radar ampliado: ${map.name}` : undefined}>
      <div className="radar-toolbar">
        <span>{map.name} <span className="radar-toolbar-label">· radar{activeInfo ? ` · andar ${activeInfo.label} (${activeInfo.name.toLowerCase()})` : ""}</span></span>
        <button ref={toggle} type="button" className="button secondary radar-expand" aria-expanded={expanded}
          onClick={() => setExpanded(value => !value)}>{expanded ? "Reduzir radar" : "Ampliar radar"}</button>
      </div>
      <div className={`radar-frame ${editing ? "radar-edit" : ""}`}>
        {broken === radarUrl ? (
          <div className="empty-state" role="alert">
            <Icon name="info" />
            <h3>Radar indisponível</h3>
            <p>
              Não foi possível carregar a imagem. Recarregue a página para
              tentar novamente.
            </p>
          </div>
        ) : (
          <div className={`radar-image ${leveled ? "is-cropped" : ""}`}
            style={leveled ? { aspectRatio: `${leveled.viewport.width} / ${leveled.viewport.height}` } : undefined}>
            <div className={leveled ? "radar-canvas" : "radar-plain"}
              style={leveled ? {
                width: `${100 / leveled.viewport.width}%`,
                left: `${-(leveled.viewport.x / leveled.viewport.width) * 100}%`,
                top: `${-(leveled.viewport.y / leveled.viewport.height) * 100}%`,
              } : undefined}>
            <img
              src={radarUrl}
              width={map.width}
              height={map.height}
              alt={`Radar ${map.illustrative ? "ilustrativo" : "do mapa"} ${map.name}${activeInfo ? `, andar ${activeInfo.label} (${activeInfo.name.toLowerCase()})` : ""}`}
              draggable={false}
              onError={() => setBroken(radarUrl)}
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
            {editing && origin && isTarget(origin) && onLevel(originLevel) && <button type="button" className="origin-marker origin-draft"
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
            {extraTargets?.map((point,index) => isTarget(point) && onLevel(point.level) && <button type="button" key={`extra-${index}`} className={`target-marker draft-target ${index === selectedTargetIndex ? "selected" : ""}`} style={{left:`${point.x * 100}%`,top:`${point.y * 100}%`}} aria-label={`Selecionar destino ${index + 1} para reposicionar`} aria-pressed={marking === "target" && index === selectedTargetIndex} onClick={() => onEditTarget?.(index)}><Icon name={"type" in point ? (point.type as "smoke" | "flashbang" | "molotov") : "crosshair"} size={17} /><span className="draft-number">{index + 1}</span></button>)}
            {target && !extraTargets?.length && onLevel(targetLevel) && (
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
            {leveled && onLevelChange && <div className="radar-levels" role="group" aria-label={levelGroupLabel}>
              {leveled.levels.map((item) => <button key={item.id} type="button" className="radar-level"
                aria-label={`Andar ${item.label}, ${item.name.toLowerCase()}`} title={`${item.name}: ${item.areas}`}
                aria-pressed={item.id === activeLevel} onClick={() => onLevelChange(item.id)}>{item.label}</button>)}
            </div>}
          </div>
        )}
      </div>
      {leveled && <p className="radar-level-note" role="status">
        <span><strong>Andar {activeInfo?.label} · {activeInfo?.name}:</strong> {activeInfo?.areas}.</span>
        {onLevelChange && hiddenLevels.map((id) => {
          const other = leveled.levels.find((item) => item.id === id)!;
          return <button key={id} type="button" className="text-button" onClick={() => onLevelChange(id)}>
            {editing ? `Há pontos no andar ${other.label}` : `Também usa o andar ${other.label}`} · ver
          </button>;
        })}
      </p>}
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
