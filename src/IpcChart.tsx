import { octantKeys, octants } from "./data";
export type IpcPoint = {
  benevolence: number;
  power: number;
  color: string;
  hollow?: boolean;
  arrow?: boolean;
  label?: string;
};
/** Interpersonal circumplex: x = 友善度, y = 支配度, both −1…1. */
export default function IpcChart({
  points,
  label,
}: {
  points: IpcPoint[];
  label: string;
}) {
  const R = 100;
  const at = (deg: number, r: number) => ({
    x: Math.cos((deg * Math.PI) / 180) * r,
    y: -Math.sin((deg * Math.PI) / 180) * r,
  });
  return (
    <svg
      className="ipc-chart"
      viewBox="-150 -132 300 264"
      role="img"
      aria-label={label}
    >
      <circle r={R} className="ipc-ring" />
      <circle r={R / 2} className="ipc-ring faint" />
      {octantKeys.map((k) => {
        const edge = at(octants[k].angle + 22.5, R);
        const text = at(octants[k].angle, R + 17);
        return (
          <g key={k}>
            <line x1={0} y1={0} x2={edge.x} y2={edge.y} className="ipc-spoke" />
            <text
              x={text.x}
              y={text.y + 4}
              textAnchor={
                Math.abs(text.x) < 5 ? "middle" : text.x > 0 ? "start" : "end"
              }
              fill={octants[k].color}
            >
              {octants[k].name}
            </text>
          </g>
        );
      })}
      <line x1={-R} y1={0} x2={R} y2={0} className="ipc-axis" />
      <line x1={0} y1={-R} x2={0} y2={R} className="ipc-axis" />
      {points.map((p, i) => {
        const x = p.benevolence * R,
          y = -p.power * R;
        return (
          <g key={i} style={{ color: p.color }}>
            {p.arrow && (
              <line
                x1={0}
                y1={0}
                x2={x}
                y2={y}
                stroke="currentColor"
                strokeWidth="1.4"
                opacity=".75"
              />
            )}
            <circle
              cx={x}
              cy={y}
              r={p.arrow ? 5 : 3.2}
              fill={p.hollow ? "none" : "currentColor"}
              stroke="currentColor"
              strokeWidth="1.2"
              opacity={p.arrow ? 1 : 0.75}
            >
              {p.label && <title>{p.label}</title>}
            </circle>
            {p.arrow && p.label && (
              <text
                x={x + (x >= 0 ? 8 : -8)}
                y={y - 8}
                textAnchor={x >= 0 ? "start" : "end"}
                fill="currentColor"
                className="ipc-point-label"
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
