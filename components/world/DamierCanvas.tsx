import React, { useEffect, useMemo, useRef } from 'react';
import { DAMIER, DamierCell, cellOrigin, damierSize, drawDamier } from '../../art/draw/damier';
import { HOUR_LIGHT, PALETTE } from '../../art/palette';

export type Hour = 20 | 21 | 22 | 23;

export interface MoveTarget {
  kind: 'walk' | 'knight' | 'elevator';
  minutes: number;
}

interface DamierCanvasProps {
  cells: DamierCell[];
  visited: ReadonlySet<string>;
  clinamenId: string;
  hour: Hour;
  current?: string | null;
  lastMove?: { from: string; to: string; kind: MoveTarget['kind'] } | null;
  lamps?: ReadonlySet<string>;
  changed?: ReadonlySet<string>;
  targets?: Record<string, MoveTarget>;
  selected?: string | null;
  onSelect?: (cellId: string) => void;
  titleFor?: (cellId: string) => string;
  caption?: { title: string; text: string } | null;
  className?: string;
}

const PX_PER_CELL = 84;
const UNIT = damierSize(1);

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function pct(cell: DamierCell) {
  const { x, y } = cellOrigin(cell.floor, cell.col, 1);
  return {
    left: `${(x / UNIT.width) * 100}%`,
    top: `${(y / UNIT.height) * 100}%`,
    width: `${(1 / UNIT.width) * 100}%`,
    height: `${(1 / UNIT.height) * 100}%`,
  };
}

const KnightPiece: React.FC = () => (
  <svg viewBox="0 0 40 48" className="w-full h-full drop-shadow-[2px_3px_0_rgba(28,26,25,0.35)]" aria-hidden>
    <path
      d="M10 44 h22 l-2 -5 h-18 z M13 39 c0 -7 4 -10 8 -14 c-4 1 -7 0 -9 -2 l3 -5 c1 -5 5 -9 11 -10 l1 -3 l3 4 c4 3 5 9 4 16 c-1 5 -2 9 -2 14 z"
      fill={PALETTE.ink}
      stroke={PALETTE.linen}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <circle cx="23.5" cy="14" r="1.3" fill={PALETTE.linen} />
  </svg>
);

/** Valène's canvas: the building as a 10×10 charcoal grid that colours in as you enter cells. */
const DamierCanvas: React.FC<DamierCanvasProps> = ({
  cells,
  visited,
  clinamenId,
  hour,
  current,
  lastMove,
  lamps,
  changed,
  targets,
  selected,
  onSelect,
  titleFor,
  caption,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visitedKey = useMemo(() => Array.from(visited).sort().join(','), [visited]);
  const [markerCellId, setMarkerCellId] = React.useState<string | null>(current || null);

  useEffect(() => {
    if (!current) {
      setMarkerCellId(null);
      return;
    }
    if (!lastMove || lastMove.to !== current) {
      setMarkerCellId(current);
      return;
    }
    const from = cells.find((cell) => cell.id === lastMove.from);
    const to = cells.find((cell) => cell.id === lastMove.to);
    if (!from || !to) {
      setMarkerCellId(current);
      return;
    }
    setMarkerCellId(from.id);
    let intermediate: string | null = null;
    if (lastMove.kind === 'knight') {
      const dc = to.col - from.col;
      const df = to.floor - from.floor;
      const floor = Math.abs(df) === 2 ? from.floor + Math.sign(df) * 2 : from.floor;
      const col = Math.abs(dc) === 2 ? from.col + Math.sign(dc) * 2 : from.col;
      intermediate = cells.find((cell) => cell.floor === floor && cell.col === col)?.id || null;
    }
    const first = window.requestAnimationFrame(() => setMarkerCellId(intermediate || to.id));
    const second = window.setTimeout(() => setMarkerCellId(to.id), 280);
    return () => {
      window.cancelAnimationFrame(first);
      window.clearTimeout(second);
    };
  }, [cells, current, lastMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = damierSize(PX_PER_CELL);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawDamier(ctx, { cells, visited, clinamenId }, PX_PER_CELL);
  }, [cells, visitedKey, clinamenId]);

  const currentCell = cells.find((c) => c.id === markerCellId);

  return (
    <div
      className={`relative w-full select-none ${className || ''}`}
      style={{ aspectRatio: `${UNIT.width} / ${UNIT.height}` }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {(Object.keys(HOUR_LIGHT) as unknown as Hour[]).map((h) => {
        const light = HOUR_LIGHT[h];
        return (
          <div
            key={h}
            className="absolute inset-0 pointer-events-none transition-opacity duration-[2400ms] ease-in-out"
            style={{ opacity: Number(h) === hour ? 1 : 0 }}
            aria-hidden
          >
            <div
              className="absolute inset-0"
              style={{
                mixBlendMode: 'multiply',
                background: `linear-gradient(${light.angle}deg, ${rgba(light.shade, light.strength * 0.55)} 0%, ${rgba(light.shade, 0)} 55%), linear-gradient(${light.angle + 180}deg, ${rgba(light.tint, light.strength)} 0%, ${rgba(light.tint, 0)} 70%)`,
              }}
            />
            <div className="absolute inset-0" style={{ mixBlendMode: 'multiply', background: rgba(light.shade, light.night) }} />
          </div>
        );
      })}

      {cells.map((cell) => {
        const isTarget = Boolean(targets?.[cell.id]);
        const target = targets?.[cell.id];
        const lit = lamps?.has(cell.id);
        const isChanged = changed?.has(cell.id);
        const isSelected = selected === cell.id;
        const style = pct(cell);
        return (
          <button
            key={cell.id}
            type="button"
            className={`damier-cell ${isTarget ? 'is-target' : ''} ${isSelected ? 'is-selected' : ''} ${cell.id === clinamenId ? 'is-clinamen' : ''}`}
            style={style}
            title={titleFor?.(cell.id)}
            aria-label={titleFor?.(cell.id) || cell.id}
            onClick={() => onSelect?.(cell.id)}
            disabled={!onSelect}
          >
            {lit && (
              <>
                <span className="damier-lamp" style={{ background: `radial-gradient(circle at 50% 30%, ${rgba(PALETTE.light, 0.75)} 0%, ${rgba(PALETTE.brass, 0.25)} 45%, ${rgba(PALETTE.light, 0)} 72%)` }} />
                <span className="damier-lamp-bulb" />
              </>
            )}
            {isChanged && <span className="damier-changed">新</span>}
            {target && cell.id !== current && (
              <span className={`damier-tag damier-tag-${target.kind}`}>
                {target.kind === 'knight' ? '♞ ' : target.kind === 'elevator' ? '⇅ ' : ''}
                {target.minutes}′
              </span>
            )}
          </button>
        );
      })}

      {currentCell && (
        <div className="damier-knight" style={pct(currentCell)} aria-hidden>
          <div className="absolute inset-[14%]">
            <KnightPiece />
          </div>
        </div>
      )}

      {caption && (
        <div className="damier-caption" key={caption.title}>
          <div className="world-kicker">{caption.title}</div>
          <div className="world-prose text-sm mt-1">{caption.text}</div>
        </div>
      )}
      <span className="sr-only">{DAMIER.cols}×{DAMIER.rows}</span>
    </div>
  );
};

export default DamierCanvas;
