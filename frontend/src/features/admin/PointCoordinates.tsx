import type { Target } from "../../domain/types";

export function PointCoordinates({ value, onChange, origin = false, error }: {
  value: Target | null;
  onChange: (point: Target) => void;
  origin?: boolean;
  error?: string;
}) {
  return <div className="field-row coordinates">
    {(["x", "y"] as const).map((axis) => (
      <label key={axis}>
        {origin ? "Origem" : "Coordenada"} {axis.toUpperCase()} (%)
        <input type="number" min="0" max="100" step="0.1"
          value={value && Number.isFinite(value[axis]) ? Number((value[axis] * 100).toFixed(2)) : ""}
          aria-invalid={!!error}
          onChange={(event) => onChange({
            x: value?.x ?? .5, y: value?.y ?? .5,
            [axis]: event.target.value === "" ? NaN : Number(event.target.value) / 100,
          })} />
      </label>
    ))}
  </div>;
}
