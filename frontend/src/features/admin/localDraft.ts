import type { LineupDraft, Target, SoloDestination } from "../../domain/types";
import { isTarget } from "../../domain/lineups";

/** Only non-media form fields are persisted. Never serialize the full draft. */
export type LocalDraft = {
  version: 1;
  baseUpdatedAt: string | null;
  step: 0 | 1 | 2;
  originTouched: boolean;
  mapChanged: boolean;
  fields: Pick<LineupDraft, "title" | "mapId" | "type" | "side" | "instructions" | "target" | "origin" | "destinations">;
};

export function localDraftKey(accountId: string, lineupId?: string): string {
  return `pcdnades:draft:v1:${encodeURIComponent(accountId)}:${lineupId ? `edit:${encodeURIComponent(lineupId)}` : "new"}`;
}

export function makeLocalDraft(draft: LineupDraft, step: 0 | 1 | 2, baseUpdatedAt: string | null, originTouched: boolean, mapChanged: boolean): LocalDraft {
  const point = (value: Target | null | undefined) => value ? { x: value.x, y: value.y } : null;
  return {
    version: 1, step, baseUpdatedAt, originTouched, mapChanged,
    fields: {
      title: draft.title, mapId: draft.mapId, type: draft.type, side: draft.side,
      instructions: draft.instructions, target: point(draft.target), origin: point(draft.origin),
      destinations: draft.destinations?.map(({ x, y, type }) => ({ x, y, type })) ?? null,
    },
  };
}

export function parseLocalDraft(raw: string, mapIds: string[]): LocalDraft | null {
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const value = data as Record<string, unknown>;
    if (value.version !== 1 || ![0, 1, 2].includes(value.step as number) ||
      !(value.baseUpdatedAt === null || typeof value.baseUpdatedAt === "string") ||
      typeof value.originTouched !== "boolean" || typeof value.mapChanged !== "boolean" ||
      !value.fields || typeof value.fields !== "object") return null;
    const f = value.fields as Record<string, unknown>;
    const validPoint = (p: unknown): p is Target => !!p && typeof p === "object" && isTarget(p as Target);
    if (typeof f.title !== "string" || f.title.length > 120 || typeof f.instructions !== "string" || f.instructions.length > 6000 ||
      typeof f.mapId !== "string" || !mapIds.includes(f.mapId) || !["smoke", "flashbang", "molotov", "solo_exec"].includes(f.type as string) ||
      !["T", "CT"].includes(f.side as string) || !(f.target === null || validPoint(f.target)) ||
      !(f.origin === null || validPoint(f.origin)) ||
      !(f.destinations === null || Array.isArray(f.destinations) && f.destinations.length <= 12 && f.destinations.every((d: unknown) => validPoint(d) && ["smoke", "flashbang", "molotov"].includes((d as SoloDestination).type)))) return null;
    // Reconstruct rather than trust unknown properties from storage.
    const point = (p: unknown): Target | null => p === null ? null : { x: (p as Target).x, y: (p as Target).y };
    return { version: 1, step: value.step as 0 | 1 | 2, baseUpdatedAt: value.baseUpdatedAt as string | null,
      originTouched: value.originTouched, mapChanged: value.mapChanged,
      fields: { title: f.title, mapId: f.mapId, type: f.type as LineupDraft["type"], side: f.side as LineupDraft["side"], instructions: f.instructions,
        target: point(f.target), origin: point(f.origin), destinations: f.destinations === null ? null : (f.destinations as SoloDestination[]).map(d => ({ x: d.x, y: d.y, type: d.type })) } };
  } catch { return null; }
}
