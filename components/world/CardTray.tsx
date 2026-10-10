import React, { useEffect, useRef, useState } from 'react';
import type { CaseGraph } from '../../case/types';
import { cardIconUrl } from '../../art/cardIcons';
import { dropCombinePlan } from '../../art/stage/mechanisms';
import type { SheetLine } from '../../engine/selectors';

interface CardTrayProps {
  open: boolean;
  cards: string[];
  graph: CaseGraph | null;
  lines: SheetLine[];
  canDrop: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  getPartAt(clientX: number, clientY: number): string | null;
  onTarget(lineId: string | null): void;
  onCombine(dragged: string, other: string, lineId: string): void;
  onWobble(lineId: string): void;
  onOpenCase(): void;
  onClose(): void;
}

interface DragState {
  cardId: string;
  x: number;
  y: number;
  target: string | null;
}

interface ChoiceState {
  cardId: string;
  lineId: string;
  options: string[];
  x: number;
  y: number;
}

const CardTray: React.FC<CardTrayProps> = ({
  open,
  cards,
  graph,
  lines,
  canDrop,
  anchorRef,
  getPartAt,
  onTarget,
  onCombine,
  onWobble,
  onOpenCase,
  onClose,
}) => {
  const trayRef = useRef<HTMLDivElement>(null);
  const nothingTimeout = useRef<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [choice, setChoice] = useState<ChoiceState | null>(null);
  const [nothing, setNothing] = useState<{ x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!open) {
      setDrag(null);
      setChoice(null);
      setNothing(null);
      if (nothingTimeout.current !== null) window.clearTimeout(nothingTimeout.current);
      nothingTimeout.current = null;
      onTarget(null);
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrag(null);
        setChoice(null);
        onTarget(null);
        onClose();
      }
    };
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (trayRef.current?.contains(target) || anchorRef.current?.contains(target))) return;
      if (!drag) {
        setChoice(null);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onOutside);
    };
  }, [open, drag, anchorRef, onClose, onTarget]);

  useEffect(
    () => () => {
      if (nothingTimeout.current !== null) window.clearTimeout(nothingTimeout.current);
    },
    []
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (event: PointerEvent) => {
      setPointer({ x: event.clientX, y: event.clientY });
      const target = canDrop ? getPartAt(event.clientX, event.clientY) : null;
      setDrag((current) => current && { ...current, x: event.clientX, y: event.clientY, target });
      onTarget(target);
    };
    const onUp = (event: PointerEvent) => {
      const targetId = canDrop ? getPartAt(event.clientX, event.clientY) : null;
      const line = lines.find((candidate) => candidate.id === targetId);
      if (line && targetId) {
        const plan = dropCombinePlan(drag.cardId, line.yielded, cards);
        if (plan.kind === 'combine') {
          onCombine(drag.cardId, plan.other, targetId);
        } else if (plan.kind === 'choose') {
          setChoice({
            cardId: drag.cardId,
            lineId: targetId,
            options: plan.options,
            x: event.clientX,
            y: event.clientY,
          });
        } else {
          onWobble(targetId);
          setNothing({ x: event.clientX, y: event.clientY });
          if (nothingTimeout.current !== null) window.clearTimeout(nothingTimeout.current);
          nothingTimeout.current = window.setTimeout(() => {
            setNothing(null);
            nothingTimeout.current = null;
          }, 1500);
        }
      }
      setDrag(null);
      onTarget(null);
    };
    const onCancel = () => {
      setDrag(null);
      onTarget(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    window.addEventListener('pointercancel', onCancel, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
  }, [drag, canDrop, getPartAt, lines, cards, onTarget, onCombine, onWobble]);

  if (!open || cards.length === 0) return null;

  const labelFor = (cardId: string) => graph?.cards.find((card) => card.id === cardId)?.label ?? cardId;
  const optionLabel = (other: string) => labelFor(other);

  return (
    <div ref={trayRef} className="card-tray-layer">
      <div className="card-tray" aria-label="速写本词卡">
        <div className="card-tray-heading">
          <span>拖一张词卡，去联想</span>
          <button type="button" onClick={onOpenCase}>打开案卷</button>
        </div>
        <div className="card-tray-fan">
          {cards.map((cardId, index) => {
            const angle = cards.length < 2 ? 0 : (index / (cards.length - 1) - 0.5) * 16;
            return (
              <button
                key={cardId}
                type="button"
                className={`card-tray-card ${drag?.cardId === cardId ? 'is-dragging' : ''}`}
                style={{ transform: `rotate(${angle}deg) translateY(${Math.abs(angle) * 0.14}px)` }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setPointer({ x: event.clientX, y: event.clientY });
                  setDrag({ cardId, x: event.clientX, y: event.clientY, target: null });
                }}
                aria-label={`拖动词卡：${labelFor(cardId)}`}
              >
                <img src={cardIconUrl(cardId, 64)} alt="" />
                <span>{labelFor(cardId)}</span>
              </button>
            );
          })}
        </div>
      </div>
      {drag && (
        <div className="card-tray-ghost" style={{ left: pointer.x, top: pointer.y }}>
          <img src={cardIconUrl(drag.cardId, 96)} alt="" />
          <span>{labelFor(drag.cardId)}</span>
        </div>
      )}
      {drag?.target && (
        <span className="card-drop-tag" style={{ left: drag.x + 14, top: drag.y + 8 }}>
          联想
        </span>
      )}
      {nothing && <span className="card-drop-tag is-nothing" style={{ left: nothing.x + 12, top: nothing.y + 8 }}>先看看它</span>}
      {choice && (
        <div className="card-combine-choice" style={{ left: choice.x + 14, top: choice.y + 10 }}>
          <span>与哪张词卡联想？</span>
          {choice.options.map((other) => (
            <button
              key={other}
              type="button"
              onClick={() => {
                onCombine(choice.cardId, other, choice.lineId);
                setChoice(null);
              }}
            >
              <img src={cardIconUrl(other, 42)} alt="" />
              {optionLabel(other)}
            </button>
          ))}
          <button type="button" className="card-combine-cancel" onClick={() => setChoice(null)}>收回</button>
        </div>
      )}
    </div>
  );
};

export default CardTray;
