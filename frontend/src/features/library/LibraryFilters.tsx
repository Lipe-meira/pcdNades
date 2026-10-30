import { useId } from "react";
import type { Filters, Lineup } from "../../domain/types";
import { typeLabels } from "../../domain/types";
import { filterLineups } from "../../domain/lineups";
import { Icon } from "../../components/Icon";

export function LibraryFilters({ filters, lineups, onChange }: {
  filters: Filters;
  lineups: Lineup[];
  onChange: (change: Partial<Filters>) => void;
}) {
  const id = useId();
  // Count all types for this map and side, even when one type is selected.
  const candidates = filterLineups(lineups, { ...filters, type: "all" });
  return (
    <aside className="library-filters" aria-label="Filtros da biblioteca">
      <div className="nade-types">
        <h2>Tipos de granada</h2>
        <div role="group" aria-label="Tipo de granada" aria-describedby={`${id}-hint`}>
          {(["all", "smoke", "molotov", "flashbang"] as const).map((type) => {
            const label = type === "all" ? "Todas" : typeLabels[type];
            const count = type === "all" ? candidates.length
              : candidates.filter((item) => item.type === type).length;
            return (
              <button key={type} type="button" className="nade-type"
                aria-label={label} aria-pressed={filters.type === type}
                aria-describedby={`${id}-${type}-count`}
                onClick={() => onChange({ type })}>
                <span className={`nade-type-icon ${type}`}>
                  <Icon name={type === "all" ? "crosshair" : type} size={19} />
                </span>
                <span>{label}</span>
                <span id={`${id}-${type}-count`} className="nade-type-count">
                  <span aria-hidden="true">{count}</span>
                  <span className="filter-sr-only">{count} granadas</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="nade-sides">
        <h2>Lado do time</h2>
        <div className="nade-side-segments" role="group" aria-label="Lado do time">
          {(["all", "CT", "T"] as const).map((side) => (
            <button key={side} type="button" aria-pressed={filters.side === side}
              onClick={() => onChange({ side })}>
              {side === "all" ? "Ambos" : side}
            </button>
          ))}
        </div>
      </div>
      <p id={`${id}-hint`} className="filter-count-hint">Contagens neste mapa e lado.</p>
    </aside>
  );
}
