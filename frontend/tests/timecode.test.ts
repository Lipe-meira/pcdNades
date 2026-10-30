import { describe, expect, it } from "vitest";
import { parseTimecode, formatTimecode } from "../src/domain/timecode";
import { validateClip } from "../src/domain/clip";

describe("horários da seleção para importação", () => {
  it("aceita minutos, horas, zeros e até milésimos sem limitar a fonte ao upload", () => {
    expect(parseTimecode("00:00")).toBe(0);
    expect(parseTimecode("01:30")).toBe(90);
    expect(parseTimecode("120:00")).toBe(7200);
    expect(parseTimecode("02:00:00")).toBe(7200);
    expect(parseTimecode(" 01:59:59.125 ")).toBe(7199.125);
    expect(parseTimecode("00:00.001")).toBe(.001);
  });
  it("recusa campos incompletos, negativos, segundos/minutos inválidos e precisão excedida", () => {
    for (const value of ["", "90", "1:2", "00:60", "1:60:00", "-01:00", "00:-1", "00:00.0001", "Infinity:00", "1e3:00", "00:00x", "999999999999999999:00"])
      expect(parseTimecode(value), value).toBeNull();
  });
  it("formata horas, arredonda ao milésimo e faz roundtrip", () => {
    for (const seconds of [0, .001, .1, 59.999, 90, 3599.999, 3600, 7200.125])
      expect(parseTimecode(formatTimecode(seconds))).toBeCloseTo(seconds, 3);
    expect(formatTimecode(7200.125)).toBe("02:00:00.125");
    expect(formatTimecode(3599.9999)).toBe("01:00:00");
    for (const seconds of [-1, NaN, Infinity]) expect(formatTimecode(seconds)).toBe("");
  });
  it("valida trecho90 no fim de fonte2h sem tratar a duração inteira como saída", () => {
    const startSeconds = parseTimecode("01:58:30")!;
    const endSeconds = parseTimecode("02:00:00")!;
    expect(validateClip({ startSeconds, endSeconds }, { maxDurationSeconds: 90, sourceDurationSeconds: 7200 })).toBeNull();
    expect(validateClip({ startSeconds: startSeconds - .001, endSeconds }, { maxDurationSeconds: 90, sourceDurationSeconds: 7200 })).toContain("90");
    expect(validateClip({ startSeconds, endSeconds: 7200.001 }, { maxDurationSeconds: 90, sourceDurationSeconds: 7200 })).toBeTruthy();
  });
});
