import type { Lineup, Target } from "./types";

/** Identificadores estáveis de andar, gravados no banco e na API. */
export const mapLevelIds = ["upper", "lower"] as const;
export type MapLevelId = (typeof mapLevelIds)[number];
export const isMapLevelId = (value: unknown): value is MapLevelId =>
  (mapLevelIds as readonly unknown[]).includes(value);

/** Retângulo normalizado (0–1) do radar 1024×1024 mostrado na tela. Não altera coordenadas gravadas. */
export type RadarViewport = { x: number; y: number; width: number; height: number };

export type MapLevel = {
  id: MapLevelId;
  /** Rótulo curto do botão: 1 = andar superior, 2 = andar inferior. */
  label: string;
  name: string;
  /** Regiões principais, usadas só em textos de apoio. */
  areas: string;
  radarUrl: string;
};

export type LeveledMap = {
  defaultLevel: MapLevelId;
  levels: readonly MapLevel[];
  viewport: RadarViewport;
};

/** Pixels do PNG 1024×1024 → coordenadas normalizadas. */
const px = (x: number, y: number, width: number, height: number): RadarViewport => ({
  x: x / 1024, y: y / 1024, width: width / 1024, height: height / 1024,
});

/**
 * Catálogo de mapas com mais de um andar. Cada nível usa o mesmo sistema de coordenadas do radar
 * original (mesma calibração, PNG 1024×1024); adicionar outro mapa é incluir uma entrada aqui e o
 * id em `private.map_has_levels` (migration) e `levelMaps` (backend).
 * Nuke: a caixa abaixo cobre o conteúdo desenhado (px 63–998 × 280–769) com folga.
 */
export const mapLevelCatalog: Readonly<Record<string, LeveledMap>> = {
  nuke: {
    defaultLevel: "upper",
    viewport: px(36, 252, 988, 545),
    levels: [
      { id: "upper", label: "1", name: "Superior", areas: "Bomb A, Outside, Lobby", radarUrl: "/maps/valve/nuke.png" },
      { id: "lower", label: "2", name: "Inferior", areas: "Bomb B, Secret, Decon", radarUrl: "/maps/valve/nuke_lower.png" },
    ],
  },
};

export const levelsOf = (mapId: string): LeveledMap | undefined => mapLevelCatalog[mapId];
export const hasLevels = (mapId: string) => mapId in mapLevelCatalog;

export function levelFor(mapId: string, level?: MapLevelId | null): MapLevelId | undefined {
  const config = levelsOf(mapId);
  if (!config) return undefined;
  return level && config.levels.some((item) => item.id === level) ? level : config.defaultLevel;
}

export function levelInfo(mapId: string, level?: MapLevelId | null): MapLevel | undefined {
  const id = levelFor(mapId, level);
  return levelsOf(mapId)?.levels.find((item) => item.id === id);
}

export const levelText = (mapId: string, level?: MapLevelId | null) => {
  const info = levelInfo(mapId, level);
  return info ? `andar ${info.label} (${info.name.toLowerCase()})` : "";
};

/** Posição de um ponto normalizado dentro do recorte exibido (0–1 do recorte); null se fora dele. */
export function pointInViewport(point: Target, viewport: RadarViewport): Target {
  return { x: (point.x - viewport.x) / viewport.width, y: (point.y - viewport.y) / viewport.height };
}

/** Andar em que a granada cai (primeiro destino no Solo Exec); null em mapas sem andares. */
export function primaryLevel(item: Lineup): MapLevelId | undefined {
  return levelFor(item.mapId, item.type === "solo_exec" ? item.destinations?.[0]?.level ?? item.targetLevel : item.targetLevel);
}
