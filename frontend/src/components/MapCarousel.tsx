import { useEffect, useRef, useState } from "react";
import type { GameMap } from "../domain/types";

function MapThumbnail({ map }: { map: GameMap }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="map-thumbnail" aria-hidden="true">
      {broken ? <span>{map.name.slice(0, 2)}</span> : (
        <img src={map.radarUrl} alt="" width="48" height="32" draggable={false}
          onError={() => setBroken(true)} />
      )}
    </span>
  );
}

export function MapCarousel({ maps, selectedId, onSelect }: {
  maps: GameMap[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  function reveal(button: HTMLButtonElement) {
    const rail = list.current;
    if (!rail) return;
    const item = button.getBoundingClientRect();
    const frame = rail.getBoundingClientRect();
    const shift = item.left < frame.left + 4 ? item.left - frame.left - 4
      : item.right > frame.right - 4 ? item.right - frame.right + 4 : 0;
    // Scroll only this rail; selecting a map must not jump the page vertically.
    if (shift) rail.scrollBy({ left: shift, behavior: "instant" });
  }
  useEffect(() => {
    const revealSelected = () => {
      const button = buttons.current.get(selectedId);
      if (button) reveal(button);
    };
    revealSelected();
    const observer = new ResizeObserver(revealSelected);
    if (list.current) observer.observe(list.current);
    return () => observer.disconnect();
  }, [selectedId, maps]);
  return (
    <nav className="map-carousel" aria-label="Selecionar mapa">
      <ul ref={list}>
        {maps.map((map, index) => (
          <li key={map.id}>
            <button type="button" aria-current={selectedId === map.id ? "true" : undefined}
              ref={(node) => { if (node) buttons.current.set(map.id, node); else buttons.current.delete(map.id); }}
              onFocus={(event) => reveal(event.currentTarget)}
              onClick={() => onSelect(map.id)}
              onKeyDown={(event) => {
                const target = event.key === "ArrowRight" ? Math.min(index + 1, maps.length - 1)
                  : event.key === "ArrowLeft" ? Math.max(index - 1, 0)
                  : event.key === "Home" ? 0 : event.key === "End" ? maps.length - 1 : undefined;
                if (target === undefined) return;
                event.preventDefault();
                buttons.current.get(maps[target].id)?.focus({ preventScroll: true });
              }}>
              <MapThumbnail key={map.radarUrl} map={map} />
              <span>{map.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
