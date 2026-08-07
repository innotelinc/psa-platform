// Lightweight SVG charts — no chart library needed.
import React from 'react';

export function AreaChart({ data, height = 140, color = '#ff2d78', format = (n: number) => String(n) }: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (n: number) => string;
}) {
  if (!data.length) return null;
  const w = 600, h = height, pad = 8;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const span = max - min || 1;
  const pts = data.map((d, i) => {
    const x = pad + (i / Math.max(1, data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  const gid = React.useId().replace(/:/g, '');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 4.5 : 2.5} fill={color} stroke="#0b0b18" strokeWidth="1.5">
          <title>{data[i].label}: {format(data[i].value)}</title>
        </circle>
      ))}
    </svg>
  );
}

export function BarRow({ label, value, max, color = '#ff2d78', icon }: { label: string; value: number; max: number; color?: string; icon?: React.ReactNode }) {
  const pct = Math.max(3, (value / Math.max(1, max)) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="between small" style={{ marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{icon}{label}</span>
        <b>{value.toLocaleString()}</b>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${color}, ${color}88)`, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
    </div>
  );
}

export function Donut({ value, max = 100, size = 130, stroke = 10, color = '#ff2d78', children }: {
  value: number; max?: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  return (
    <div className="fame-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#ringGrad)`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(c * pct).toFixed(1)} ${c.toFixed(1)}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.34,1.56,0.64,1)' }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div className="val">{children}</div>
    </div>
  );
}
