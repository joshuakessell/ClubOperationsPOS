import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LogEvent, onEvent } from '../lib/eventBus';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

const MAX_EVENTS = 500;

export default function EventLogOverlay() {
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [show, setShow] = useState(import.meta.env.MODE !== 'production');
  const [paused, setPaused] = useState(false);

  const [filterWSIn, setFilterWSIn] = useState(true);
  const [filterWSOut, setFilterWSOut] = useState(true);
  const [filterDB, setFilterDB] = useState(true);
  const [q, setQ] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = onEvent((e) => {
      if (paused) return;
      setEvents((prev) => [...prev, e].slice(-MAX_EVENTS));
    });
    return () => {
      off();
    };
  }, [paused]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const filtered = useMemo(() => {
    const kinds = new Set<string>();
    if (filterWSIn) kinds.add('ws-in');
    if (filterWSOut) kinds.add('ws-out');
    if (filterDB) kinds.add('db');

    const s = q.trim().toLowerCase();

    return events.filter((e) => {
      if (!kinds.has(e.kind)) return false;
      if (!s) return true;

      const hay = [
        e.title,
        e.channel ?? '',
        (() => {
          try {
            return JSON.stringify(e.payload ?? '');
          } catch {
            return String(e.payload ?? '');
          }
        })(),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(s);
    });
  }, [events, filterWSIn, filterWSOut, filterDB, q]);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 right-3 z-[999999] w-[420px] max-h-[60vh] overflow-hidden rounded-xl bg-slate-950/90 font-mono text-xs text-white shadow-2xl ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-center justify-between gap-3 bg-white/5 p-3">
        <strong className="text-sm">Event Log</strong>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            size="md"
            placeholder="Search…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 w-[180px] bg-black/30 text-xs text-white placeholder:text-white/50 ring-white/15"
          />
          <label className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1">
            <input
              type="checkbox"
              checked={filterWSIn}
              onChange={(e) => setFilterWSIn(e.target.checked)}
            />
            <span>WS In</span>
          </label>
          <label className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1">
            <input
              type="checkbox"
              checked={filterWSOut}
              onChange={(e) => setFilterWSOut(e.target.checked)}
            />
            <span>WS Out</span>
          </label>
          <label className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1">
            <input type="checkbox" checked={filterDB} onChange={(e) => setFilterDB(e.target.checked)} /> DB
          </label>
          <Button
            size="md"
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button
            size="md"
            variant="secondary"
            className="h-8 px-3 text-xs"
            onClick={() => navigator.clipboard.writeText(JSON.stringify(filtered, null, 2))}
          >
            Copy
          </Button>
          <Button size="md" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setEvents([])}>
            Clear
          </Button>
          <Button size="md" variant="secondary" className="h-8 px-3 text-xs" onClick={() => setShow(false)}>
            Hide
          </Button>
        </div>
      </div>

      <div className="max-h-[calc(60vh-52px)] overflow-auto p-2">
        {filtered.map((e) => (
          <Card
            key={e.id}
            padding="sm"
            className={[
              'mb-2 bg-white/5 ring-1 ring-white/10',
              borderClassFor(e.kind),
            ].join(' ')}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={tagClassFor(e.kind)}>{e.kind}</span>
              <span className="opacity-80">{new Date(e.ts).toLocaleTimeString()}</span>
              {e.channel && <span className="opacity-80">· {e.channel}</span>}
              <strong>· {e.title}</strong>
            </div>

            {e.payload !== undefined && (
              <pre className="m-0 whitespace-pre-wrap break-words rounded bg-black/35 p-2">
                {safeStringify(e.payload)}
              </pre>
            )}
          </Card>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function borderClassFor(k: LogEvent['kind']) {
  if (k === 'ws-in') return 'border-l-4 border-emerald-400';
  if (k === 'ws-out') return 'border-l-4 border-sky-400';
  return 'border-l-4 border-amber-300';
}

function tagClassFor(k: LogEvent['kind']) {
  if (k === 'ws-in') return 'rounded-full bg-emerald-300 px-2 py-0.5 font-bold uppercase text-slate-950';
  if (k === 'ws-out') return 'rounded-full bg-sky-300 px-2 py-0.5 font-bold uppercase text-slate-950';
  return 'rounded-full bg-amber-200 px-2 py-0.5 font-bold uppercase text-slate-950';
}

function safeStringify(v: unknown) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

