import { describe, expect, it } from "vitest";
import {
  validateClip,
  previewBounds,
  clampPreviewTime,
  formatTime,
} from "../src/domain/clip";

describe("intervalo de prévia com limites explícitos", () => {
  it('respeita mínimo0,1s e precisão0,001 sem presumir fps', () => {
    expect(validateClip({ startSeconds: 0, endSeconds: .099 }, { maxDurationSeconds: 90 })).not.toBeNull();
    expect(validateClip({ startSeconds: .001, endSeconds: .101 }, { maxDurationSeconds: 90 })).toBeNull();
    expect(validateClip({ startSeconds: .0001, endSeconds: 1 }, { maxDurationSeconds: 90 })).not.toBeNull();
  });
  it("aceita início/fim válidos e saída de90s, rejeita91s", () => {
    expect(
      validateClip(
        { startSeconds: 5, endSeconds: 95 },
        { maxDurationSeconds: 90, sourceDurationSeconds: 100 },
      ),
    ).toBeNull();
    expect(
      validateClip(
        { startSeconds: 5, endSeconds: 96 },
        { maxDurationSeconds: 90, sourceDurationSeconds: 100 },
      ),
    ).toContain("90");
    expect(
      validateClip(
        { startSeconds: 0, endSeconds: 90 },
        { maxDurationSeconds: 90 },
      ),
    ).toBeNull();
  });
  it("recusa dados inválidos, fim antes de início e seleção além da origem", () => {
    for (const clip of [
      { startSeconds: -1, endSeconds: 2 },
      { startSeconds: 2, endSeconds: 2 },
      { startSeconds: 4, endSeconds: 3 },
      { startSeconds: NaN, endSeconds: 4 },
      { startSeconds: 0, endSeconds: Infinity },
    ])
      expect(validateClip(clip, { maxDurationSeconds: 90 })).not.toBeNull();
    expect(
      validateClip(
        { startSeconds: 1, endSeconds: 11 },
        { maxDurationSeconds: 90, sourceDurationSeconds: 10 },
      ),
    ).not.toBeNull();
    expect(
      validateClip(
        { startSeconds: 0.1, endSeconds: 0.2 },
        { maxDurationSeconds: 90, sourceDurationSeconds: 1 },
      ),
    ).toBeNull();
  });
  it("delimita a prévia sem alterar intervalo inválido nem fingir recorte de arquivo", () => {
    const clip = { startSeconds: 3, endSeconds: 5 };
    expect(previewBounds(10, clip)).toEqual({ startSeconds: 3, endSeconds: 5 });
    expect(previewBounds(10)).toEqual({ startSeconds: 0, endSeconds: 10 });
    expect(previewBounds(10, { startSeconds: 3, endSeconds: 20 })).toBeNull();
    expect(clampPreviewTime(1, clip)).toBe(3);
    expect(clampPreviewTime(6, clip)).toBe(5);
    expect(clampPreviewTime(4, clip)).toBe(4);
    expect(formatTime(95.5)).toBe("01:35.50");
  });
});
