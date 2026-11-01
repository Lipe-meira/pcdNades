import { useState } from "react";
import type { Clip } from "../../domain/clip";
import type { ImportInspection } from "../../domain/imports";
import { importSelectionError } from "../../domain/imports";
import { formatTimecode, parseTimecode } from "../../domain/timecode";

export function ImportClipSelector({ inspection, clip, disabled, onChange }: {
  inspection: ImportInspection; clip: Clip; disabled: boolean; onChange: (clip: Clip) => void;
}) {
  const [text, setText] = useState({ startSeconds: formatTimecode(clip.startSeconds), endSeconds: formatTimecode(clip.endSeconds) });
  const error = importSelectionError(inspection, clip);
  return <div className="import-clip">
    <h4>2. Selecione o trecho</h4>
    <p className="field-hint">Use mm:ss ou hh:mm:ss, com até três casas decimais nos segundos.</p>
    <div className="clip-times">
      {(["startSeconds", "endSeconds"] as const).map((field) => <label key={field}>
        {field === "startSeconds" ? "Início do trecho" : "Fim do trecho"}
        <input type="text" inputMode="text" autoComplete="off" spellCheck={false}
          value={text[field]} disabled={disabled} aria-invalid={!!error} placeholder="00:00"
          onChange={(event) => {
            setText(current => ({ ...current, [field]: event.target.value }));
            onChange({ ...clip, [field]: parseTimecode(event.target.value) ?? NaN });
          }} />
        <input type="range" min="0" max={inspection.durationSeconds}
          step={inspection.limits.timePrecisionSeconds} disabled={disabled}
          aria-label={field === "startSeconds" ? "Ajustar início da importação" : "Ajustar fim da importação"}
          value={Number.isFinite(clip[field]) ? clip[field] : 0}
          onChange={(event) => {
            const seconds = Number(event.target.value);
            setText(current => ({ ...current, [field]: formatTimecode(seconds) }));
            onChange({ ...clip, [field]: seconds });
          }} />
      </label>)}
    </div>
    <p className="clip-summary">Trecho selecionado: <strong>{formatTimecode(clip.endSeconds - clip.startSeconds) || "—"}</strong></p>
    <p className="field-hint">Arquivo final: até {inspection.limits.maxDurationSeconds}s e {(inspection.limits.maxBytes / 1_000_000).toLocaleString("pt-BR")} MB. O servidor validará o arquivo antes de publicar.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
