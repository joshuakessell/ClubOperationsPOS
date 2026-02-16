import { useMemo } from 'react';

type BarDatum = { label: string; value: number; color?: string };

type Props = {
  data: BarDatum[];
  title?: string;
  orientation?: 'vertical' | 'horizontal';
  height?: number;
  formatValue?: (v: number) => string;
  defaultColor?: string;
};

const DEFAULT_COLOR = 'rgba(99,102,241,0.7)';

export function BarChart({
  data,
  title,
  orientation = 'vertical',
  height = 200,
  formatValue = (v) => String(v),
  defaultColor = DEFAULT_COLOR,
}: Props) {
  const maxValue = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);

  if (orientation === 'horizontal') {
    return (
      <div>
        {title && (
          <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
            {title}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.map((d) => (
            <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 80,
                  fontSize: '0.75rem',
                  textAlign: 'right',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {d.label}
              </span>
              <div
                style={{
                  flex: 1,
                  height: 22,
                  backgroundColor: 'var(--surface-raised, #f0f0f0)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    width: `${(d.value / maxValue) * 100}%`,
                    height: '100%',
                    backgroundColor: d.color ?? defaultColor,
                    borderRadius: 4,
                    transition: 'width 0.4s ease',
                    minWidth: d.value > 0 ? 4 : 0,
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {formatValue(d.value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Vertical
  return (
    <div>
      {title && (
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
          {title}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: data.length > 12 ? 2 : 6,
          height,
          paddingBottom: 24,
          position: 'relative',
        }}
      >
        {data.map((d) => {
          const pct = (d.value / maxValue) * 100;
          return (
            <div
              key={d.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
              }}
            >
              <div
                title={`${d.label}: ${formatValue(d.value)}`}
                style={{
                  width: '100%',
                  maxWidth: 40,
                  height: `${Math.max(pct, d.value > 0 ? 3 : 0)}%`,
                  backgroundColor: d.color ?? defaultColor,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.4s ease',
                }}
              />
              <span
                style={{
                  fontSize: '0.6rem',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                  position: 'absolute',
                  bottom: 0,
                  transform: data.length > 12 ? 'rotate(-45deg)' : 'none',
                  transformOrigin: 'top center',
                  whiteSpace: 'nowrap',
                }}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
