import { formatTime, validateClip } from "../../domain/clip";
import type { Clip } from "../../domain/clip";
import type { TrimmingCapability } from "../../services/apiContracts";

export function ClipSelector({
  clip,
  duration,
  limits,
  disabledReason,
  onChange,
}: {
  clip?: Clip;
  duration?: number;
  limits?: TrimmingCapability;
  disabledReason?: string;
  onChange: (clip?: Clip) => void;
}) {
  const enabled = limits?.enabled === true && !disabledReason;
  const sourceMax = duration ?? limits?.maxSourceDurationSeconds ?? 180;
  const error = clip
    ? !enabled
      ? disabledReason || "O recorte está indisponível neste ambiente."
      : validateClip(clip, { ...limits!, sourceDurationSeconds: sourceMax })
    : null;
  function change(key: keyof Clip, value: string) {
    onChange({ ...clip!, [key]: value === "" ? NaN : Number(value) });
  }
  return (
    <div className="clip-editor">
      <label className="clip-toggle">
        <input
          type="checkbox"
          checked={!!clip}
          disabled={!enabled && !clip}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    startSeconds: 0,
                    endSeconds:
                      Math.floor(
                        Math.min(sourceMax, limits?.maxDurationSeconds ?? 90) *
                          1000,
                      ) / 1000,
                  }
                : undefined,
            )
          }
        />
        Selecionar trecho
      </label>
      {!enabled && (
        <p className="field-hint">
          {disabledReason ||
            "Recorte indisponível no servidor. Enviar o vídeo inteiro continua disponível dentro do limite."}
        </p>
      )}
      {clip && (
        <>
          <div className="clip-times">
            <label>
              Início (segundos)
              <input
                type="number"
                min="0"
                max={sourceMax}
                step="0.001"
                value={
                  Number.isFinite(clip.startSeconds) ? clip.startSeconds : ""
                }
                disabled={!enabled}
                aria-invalid={!!error}
                onChange={(event) => change("startSeconds", event.target.value)}
              />
              {duration !== undefined && (
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.001"
                  value={
                    Number.isFinite(clip.startSeconds)
                      ? Math.min(clip.startSeconds, duration)
                      : 0
                  }
                  disabled={!enabled}
                  aria-label="Ajustar início do trecho"
                  onChange={(event) =>
                    change("startSeconds", event.target.value)
                  }
                />
              )}
            </label>
            <label>
              Fim (segundos)
              <input
                type="number"
                min="0"
                max={sourceMax}
                step="0.001"
                value={Number.isFinite(clip.endSeconds) ? clip.endSeconds : ""}
                disabled={!enabled}
                aria-invalid={!!error}
                onChange={(event) => change("endSeconds", event.target.value)}
              />
              {duration !== undefined && (
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.001"
                  value={
                    Number.isFinite(clip.endSeconds)
                      ? Math.min(clip.endSeconds, duration)
                      : duration
                  }
                  disabled={!enabled}
                  aria-label="Ajustar fim do trecho"
                  onChange={(event) => change("endSeconds", event.target.value)}
                />
              )}
            </label>
          </div>
          <p className="clip-summary">
            {formatTime(clip.startSeconds)} → {formatTime(clip.endSeconds)}{" "}
            <span>
              Trecho: {formatTime(clip.endSeconds - clip.startSeconds)}
            </span>
          </p>
          <p className="field-hint">
            Selecione de {limits?.minDurationSeconds ?? 0.1} a{" "}
            {limits?.maxDurationSeconds ?? 90}s, com até três casas decimais.
          </p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      {!clip && duration !== undefined && (
        <p className="field-hint">
          Vídeo inteiro: {formatTime(duration)}. Nenhum recorte será solicitado.
        </p>
      )}
    </div>
  );
}
