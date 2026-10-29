import { describe, expect, it } from "vitest";
import { filterLineups, pointFromImage, isTarget } from "../src/domain/lineups";

describe("coordenadas relativas à imagem", () => {
  it("desconta a posição da imagem e preserva bordas inclusivas", () => {
    const image = { left: 100, top: 50, width: 400, height: 200 };
    expect(pointFromImage(300, 150, image)).toEqual({ x: 0.5, y: 0.5 });
    expect(pointFromImage(100, 50, image)).toEqual({ x: 0, y: 0 });
    expect(pointFromImage(500, 250, image)).toEqual({ x: 1, y: 1 });
    expect(pointFromImage(99, 50, image)).toBeNull();
    expect(pointFromImage(300, 150, { ...image, width: 0 })).toBeNull();
  });
  it("mantém o destino ao mudar a escala da imagem", () => {
    expect(
      pointFromImage(75, 225, { left: 0, top: 0, width: 300, height: 300 }),
    ).toEqual(
      pointFromImage(150, 450, { left: 0, top: 0, width: 600, height: 600 }),
    );
    expect(isTarget({ x: NaN, y: 0.5 })).toBe(false);
    expect(isTarget({ x: 1.01, y: 0 })).toBe(false);
    expect(isTarget({ x: 0, y: 1 })).toBe(true);
  });
});

describe("filtros combinados", () => {
  const items = [
    { id: "a", mapId: "mirage", type: "smoke", side: "T" },
    { id: "b", mapId: "mirage", type: "smoke", side: "CT" },
    { id: "c", mapId: "inferno", type: "molotov", side: "T" },
  ] as const;
  it("combina mapa, tipo e lado sem alterar a coleção", () => {
    expect(
      filterLineups(items, { mapId: "mirage", type: "smoke", side: "CT" }).map(
        (x) => x.id,
      ),
    ).toEqual(["b"]);
    expect(
      filterLineups(items, { mapId: "mirage", type: "all", side: "all" }),
    ).toHaveLength(2);
    expect(
      filterLineups(items, { mapId: "mirage", type: "flashbang", side: "all" }),
    ).toEqual([]);
    expect(items).toHaveLength(3);
  });
});
