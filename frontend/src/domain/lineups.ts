import type { Filters, Target } from "./types";

export function filterLineups<
  T extends { mapId: string; type: string; side: string },
>(items: readonly T[], filters: Filters): T[] {
  return items.filter(
    (item) =>
      item.mapId === filters.mapId &&
      (filters.type === "all" || item.type === filters.type) &&
      (filters.side === "all" || item.side === filters.side),
  );
}

export function isTarget(point: Target): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function pointFromImage(
  clientX: number,
  clientY: number,
  image: { left: number; top: number; width: number; height: number },
): Target | null {
  if (image.width <= 0 || image.height <= 0) return null;
  const point = {
    x: (clientX - image.left) / image.width,
    y: (clientY - image.top) / image.height,
  };
  return isTarget(point) ? point : null;
}
