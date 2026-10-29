import type { GameMap, Lineup } from '../domain/types'
import { demoMaps, demoLineups } from './demoData'

/** Integration boundary. No URLs, authentication scheme or API envelopes assumed. */
export interface LineupService {
  listMaps(signal?: AbortSignal): Promise<GameMap[]>
  listLineups(signal?: AbortSignal): Promise<Lineup[]>
}

export function createDemoService(): LineupService {
  return {
    async listMaps(signal) { signal?.throwIfAborted(); return structuredClone(demoMaps) },
    async listLineups(signal) { signal?.throwIfAborted(); return structuredClone(demoLineups) },
  }
}
