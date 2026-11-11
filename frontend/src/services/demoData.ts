import type { GameMap, Lineup } from "../domain/types";

// OLD STYLE SETPOS
// export const demoMaps: GameMap[] = [
//   { id: "mirage", name: "Mirage" },
//   { id: "inferno", name: "Inferno" },
//   { id: "ancient", name: "Ancient" },
// ].map((map) => ({
//   ...map,
//   radarUrl: `/maps/${map.id}.svg`,
//   radarVersion: `setpos-${map.id}-ba5f793`,
//   width: 1024,
//   height: 1024,
//   illustrative: false,
//   credit: { label: "Minimaps by setpos.gg", url: "https://setpos.gg" },
//   note: "Planta vetorial simplificada · versão 23/10/2026. Pode não refletir atualizações recentes do jogo.",
// }));

// new style

export const demoMaps: GameMap[] = [
  { id: "mirage", name: "Mirage" },
  { id: "inferno", name: "Inferno" },
  { id: "ancient", name: "Ancient" },
  { id: "cache", name: "Cache" },
  { id: "nuke", name: "Nuke" },
  { id: "dust2", name: "Dust II" },
  { id: "anubis", name: "Anubis" },
].map((map) => ({
  ...map,
  radarUrl: `/maps/valve/${map.id}.png`,
  radarVersion: `valve-${map.id}-v1`,
  width: 1024,
  height: 1024,
  illustrative: false,
  credit: {
    label: "Radar de Counter-Strike 2 — Valve",
    url: "https://www.counter-strike.net/cs2",
  },
}));

const timestamp = "2026-10-28T12:00:00.000Z";
const instructions =
  "Conteúdo fictício para explorar a interface. O ponto é apenas um exemplo e não representa uma lineup validada. As instruções reais de posicionamento e execução serão cadastradas pelo time.";
export const demoLineups: Lineup[] = [
  {
    id: "demo-smoke-t",
    title: "Exemplo de smoke",
    mapId: "mirage",
    type: "smoke",
    side: "T",
    target: { x: 0.69, y: 0.61 },
  },
  {
    id: "demo-flash-t",
    title: "Exemplo de flashbang",
    mapId: "mirage",
    type: "flashbang",
    side: "T",
    target: { x: 0.48, y: 0.44 },
  },
  {
    id: "demo-molotov-ct",
    title: "Exemplo de molotov",
    mapId: "mirage",
    type: "molotov",
    side: "CT",
    target: { x: 0.26, y: 0.28 },
  },
  {
    id: "demo-smoke-ct",
    title: "Outro exemplo de smoke",
    mapId: "mirage",
    type: "smoke",
    side: "CT",
    target: { x: 0.69, y: 0.61 },
  },
  {
    id: "demo-inferno-smoke",
    title: "Exemplo de smoke",
    mapId: "inferno",
    type: "smoke",
    side: "T",
    target: { x: 0.32, y: 0.31 },
  },
  {
    id: "demo-inferno-flash",
    title: "Exemplo de flashbang",
    mapId: "inferno",
    type: "flashbang",
    side: "CT",
    target: { x: 0.69, y: 0.69 },
  },
  // Nuke: exemplos fictícios nos dois andares, inclusive um com origem e destino em andares diferentes.
  {
    id: "demo-nuke-a-smoke",
    title: "Exemplo de smoke no andar 1",
    mapId: "nuke",
    type: "smoke",
    side: "T",
    origin: { x: 0.684, y: 0.508 },
    originLevel: "upper",
    target: { x: 0.571, y: 0.322 },
    targetLevel: "upper",
  },
  {
    id: "demo-nuke-b-flash",
    title: "Exemplo de flashbang no andar 2",
    mapId: "nuke",
    type: "flashbang",
    side: "CT",
    origin: { x: 0.52, y: 0.625 },
    originLevel: "lower",
    target: { x: 0.571, y: 0.508 },
    targetLevel: "lower",
  },
  {
    id: "demo-nuke-cross-molotov",
    title: "Exemplo de molotov: origem no andar 1, destino no andar 2",
    mapId: "nuke",
    type: "molotov",
    side: "T",
    origin: { x: 0.571, y: 0.459 },
    originLevel: "upper",
    target: { x: 0.56, y: 0.4 },
    targetLevel: "lower",
  },
  {
    id: "demo-nuke-solo",
    title: "Exemplo de Solo Exec entre andares",
    mapId: "nuke",
    type: "solo_exec",
    side: "T",
    origin: { x: 0.684, y: 0.508 },
    originLevel: "upper",
    target: { x: 0.6, y: 0.34 },
    targetLevel: "upper",
    destinations: [
      { x: 0.6, y: 0.34, type: "smoke", level: "upper" },
      { x: 0.65, y: 0.6, type: "he", level: "lower" },
    ],
  },
].map((item) => ({
  ...item,
  instructions,
  video: { id: `${item.id}-video`, status: "missing" },
  createdAt: timestamp,
  updatedAt: timestamp,
})) as Lineup[];
