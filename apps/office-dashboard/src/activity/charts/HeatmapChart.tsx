import { Fragment, useMemo } from 'react';

type HeatmapCell = { day: string; hour: number; count: number };

type Props = {
  data: HeatmapCell[];
  title?: string;
  colorScale?: string[];
};

const DEFAULT_COLORS = [
  'rgba(99,102,241,0.05)',
  'rgba(99,102,241,0.15)',
  'rgba(99,102,241,0.30)',
  'rgba(99,102,241,0.50)',
  'rgba(99,102,241,0.70)',
  'rgba(99,102,241,0.90)',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function HeatmapChart({ data, title, colorScale = DEFAULT_COLORS }: Props) {
  const { max, grid } = useMemo(() => {
    const maxVal = Math.max(1, ...data.map((d) => d.count));
    const lookup = new Map(data.map((d) => [`${d.day}-${d.hour}`, d.count]));
    const gridData: { day: string; hour: number; value: number }[] = [];
    for (const day of DAYS) {
      for (let h = 0; h < 24; h++) {
        gridData.push({ day, hour: h, value: lookup.get(`${day}-${h}`) ?? 0 });
      }
    }
    return { max: maxVal, grid: gridData };
  }, [data]);

  const getColor = (value: number) => {
    if (value === 0) return colorScale[0];
    const idx = Math.min(
      colorScale.length - 1,
      Math.ceil((value / max) * (colorScale.length - 1))
    );
    return colorScale[idx];
  };

  return (
    <div>
      {title && (
        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
          {title}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '48px repeat(24, 1fr)',
            gridTemplateRows: `repeat(${DAYS.length}, 28px)`,
            gap: 2,
            minWidth: 600,
          }}
        >
          {DAYS.map((day, rowIdx) => (
            <Fragment key={day}>
              <div
                style={{
                  gridColumn: 1,
                  gridRow: rowIdx + 1,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                }}
              >
                {day}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = grid[rowIdx * 24 + h];
                return (
                  <div
                    key={h}
                    title={`${day} ${h}:00 — ${cell?.value ?? 0}`}
                    style={{
                      gridColumn: h + 2,
                      gridRow: rowIdx + 1,
                      backgroundColor: getColor(cell?.value ?? 0),
                      borderRadius: 3,
                      transition: 'background-color 0.2s',
                      cursor: 'default',
                    }}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
        {/* Hour labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '48px repeat(24, 1fr)',
            gap: 2,
            marginTop: 2,
          }}
        >
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              style={{
                fontSize: '0.6rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              {h % 3 === 0 ? `${h}` : ''}
            </div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: '0.5rem' }}>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Less</span>
        {colorScale.map((c, i) => (
          <div
            key={i}
            style={{ width: 14, height: 14, backgroundColor: c, borderRadius: 2 }}
          />
        ))}
        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>More</span>
      </div>
    </div>
  );
}
