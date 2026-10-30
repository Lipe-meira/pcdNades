/** Import editor timecodes. Upload inputs continue to use numeric seconds. */
export function parseTimecode(value: string): number | null {
  const match = /^(?:(\d+):([0-5]\d):|([0-9]+):)([0-5]\d)(?:\.(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = match[1] === undefined ? 0 : Number(match[1]);
  const minutes = Number(match[2] ?? match[3]);
  const milliseconds = Number((match[5] ?? "").padEnd(3, "0"));
  const total = (hours * 3600 + minutes * 60 + Number(match[4])) * 1000 + milliseconds;
  return Number.isSafeInteger(total) && total >= 0 ? total / 1000 : null;
}

export function formatTimecode(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000);
  if (!Number.isFinite(seconds) || seconds < 0 || !Number.isSafeInteger(milliseconds)) return "";
  const whole = Math.floor(milliseconds / 1000);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor(whole / 60) % 60;
  const tail = String(whole % 60).padStart(2, "0");
  const fraction = String(milliseconds % 1000).padStart(3, "0").replace(/0+$/, "");
  return `${hours ? `${String(hours).padStart(2, "0")}:` : ""}${String(minutes).padStart(2, "0")}:${tail}${fraction ? `.${fraction}` : ""}`;
}
