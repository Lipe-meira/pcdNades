import { expect, it } from "vitest";
import { renewalDelay } from "../src/domain/playback";

it("renova antes de expirar sem agendar laço imediato", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  expect(renewalDelay("2026-10-29T13:00:00Z", now)).toBe(3_570_000);
  expect(renewalDelay("2026-10-29T12:00:05Z", now)).toBe(1000);
  expect(renewalDelay(undefined, now)).toBeNull();
  expect(renewalDelay("invalid", now)).toBeNull();
});
