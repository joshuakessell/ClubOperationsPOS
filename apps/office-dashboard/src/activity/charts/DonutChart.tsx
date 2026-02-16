import { useMemo } from 'react';

type Segment = { label: string; value: number; color: string };

type Props = {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  title?: string;
  formatValue?: (v: number) => string;
};

const COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

export function DonutChart({
  segments: rawSegments,
  size = 180,
  strokeWidth = 28,
  title,
  formatValue = (v) => `$${v.toFixed(0)}`,
}: Props) {
  const { segments, total } = useMemo(() => {
    const colored = rawSegments.map((s, i) => ({
      ...s,
      color: s.color || COLORS[i % COLORS.length]!,
    }));
    const t = colored.reduce((sum, s) => sum + s.value, 0);
    return { segments: colored, total: t };
  }, [rawSegments]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let accumulated = 0;

  return (
    <div>
      {title && (
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background ring */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--surface-raised, #e5e7eb)"
              strokeWidth={strokeWidth}
            />
            {total > 0 &&
              segments.map((seg) => {
                const pct = seg.value / total;
                const dashLen = circumference * pct;
                const dashOffset = circumference * (0.25 - accumulated); // start from top
                accumulated += pct;
                return (
                  <circle
                    key={seg.label}
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="butt"
                    style={{ transition: 'stroke-dasharray 0.4s ease' }}
                  />
                );
              })}
          </svg>
          {/* Center label */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{formatValue(total)}</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total</span>
          </div>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {segments.map((seg) => (
            <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: seg.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {seg.label}
              </span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto' }}>
                {formatValue(seg.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
