import type { GameMap, Lineup } from '../domain/types'

// Authorial schematic, deliberately unrelated to the geography of any CS2 map.
export const demoMaps: GameMap[] = [
  { id: 'mirage', name: 'Mirage', radarUrl: '/radar-demo.svg', radarVersion: 'schematic-v1', width: 800, height: 800, illustrative: true },
  { id: 'inferno', name: 'Inferno', radarUrl: '/radar-demo.svg', radarVersion: 'schematic-v1', width: 800, height: 800, illustrative: true },
  { id: 'ancient', name: 'Ancient', radarUrl: '/radar-demo.svg', radarVersion: 'schematic-v1', width: 800, height: 800, illustrative: true },
]

const timestamp = '2026-10-28T12:00:00.000Z'
const instructions = 'Conteúdo fictício para explorar a interface. Este destino não corresponde ao mapa do jogo. As instruções reais de posicionamento e execução serão cadastradas pelo time.'
export const demoLineups: Lineup[] = [
  { id: 'demo-smoke-t', title: 'Exemplo de smoke', mapId: 'mirage', type: 'smoke', side: 'T', target: { x: 0.68, y: 0.32 } },
  { id: 'demo-flash-t', title: 'Exemplo de flashbang', mapId: 'mirage', type: 'flashbang', side: 'T', target: { x: 0.46, y: 0.52 } },
  { id: 'demo-molotov-ct', title: 'Exemplo de molotov', mapId: 'mirage', type: 'molotov', side: 'CT', target: { x: 0.27, y: 0.35 } },
  { id: 'demo-smoke-ct', title: 'Outro exemplo de smoke', mapId: 'mirage', type: 'smoke', side: 'CT', target: { x: 0.68, y: 0.32 } },
  { id: 'demo-inferno-smoke', title: 'Exemplo de smoke', mapId: 'inferno', type: 'smoke', side: 'T', target: { x: 0.35, y: 0.6 } },
  { id: 'demo-inferno-flash', title: 'Exemplo de flashbang', mapId: 'inferno', type: 'flashbang', side: 'CT', target: { x: 0.6, y: 0.4 } },
].map(item => ({ ...item, instructions, video: { id: `${item.id}-video`, status: 'missing' }, createdAt: timestamp, updatedAt: timestamp })) as Lineup[]
