import React, { useEffect, useRef } from 'react';
import type { CaseGraph } from '../../case/types';
import { SKILL_META } from '../../constants/skills';
import type { NarrativeResponse, SkillCheckResult } from '../../types';
import { cardIconUrl } from '../../art/cardIcons';
import { drawDiceHand } from '../../art/draw/hand';
import { chapterNumeral } from '../../world/damier';
import { lockReasonText, type RoomSheet, type SheetLine } from '../../engine/selectors';
import type { StageHotspot } from '../../art/stage';
import RoomStage from './RoomStage';
import type { Hour } from './DamierCanvas';

export interface PendingLineCheck {
  lineId: string;
  result: SkillCheckResult;
  rolling: boolean;
  tick: number;
}

interface RoomPageProps {
  sheet: RoomSheet;
  prose?: NarrativeResponse;
  generating: boolean;
  graph: CaseGraph | null;
  armedLineId: string | null;
  check: PendingLineCheck | null;
  onArm: (lineId: string | null) => void;
  onAct: (line: SheetLine) => void;
  onCheckDone: () => void;
  hour: Hour;
  stageMode: 'print' | 'blueprint';
  highlightedLineId: string | null;
  onHighlightLine: (lineId: string | null) => void;
  onStagePick: (lineId: string) => void;
  readOnly?: boolean;
}

const MARK: Record<SheetLine['status'], Record<SheetLine['kind'], string>> = {
  open: { look: '○', check: '◇', item: '◦', finale: '✕' },
  locked: { look: '—', check: '—', item: '—', finale: '—' },
  done: { look: '✓', check: '✓', item: '✓', finale: '✓' },
  failed: { look: '✗', check: '✗', item: '✗', finale: '✗' },
};

const KIND_VERB: Record<SheetLine['kind'], string> = {
  look: '看',
  check: '检定',
  item: '拿',
  finale: '合上案卷',
};

function cardLabel(graph: CaseGraph | null, id: string) {
  return graph?.cards.find((card) => card.id === id)?.label || id;
}

const CardChip: React.FC<{ graph: CaseGraph | null; id: string }> = ({ graph, id }) => (
  <span className="card-chip">
    <img src={cardIconUrl(id, 40)} alt="" />
    {cardLabel(graph, id)}
  </span>
);

const CheckSlip: React.FC<{
  line: SheetLine;
  graph: CaseGraph | null;
  check: PendingLineCheck | null;
  onRoll: () => void;
  onCancel: () => void;
  onDone: () => void;
}> = ({ line, graph, check, onRoll, onCancel, onDone }) => {
  const handRef = useRef<HTMLCanvasElement>(null);
  const info = line.check!;
  const meta = SKILL_META[info.skill];
  const result = check?.result;
  const d1 = result ? (check!.rolling ? 1 + (check!.tick % 6) : result.die1) : null;
  const d2 = result ? (check!.rolling ? 1 + ((check!.tick * 5) % 6) : result.die2) : null;
  const phase = !result ? 'hold' : check!.rolling ? 'shake' : 'open';

  useEffect(() => {
    const canvas = handRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(420 * ratio);
    canvas.height = Math.round(150 * ratio);
    drawDiceHand(ctx, { phase, tick: check?.tick || 0, die1: d1 || 1, die2: d2 || 1 });
  }, [phase, check?.tick, d1, d2]);

  return (
    <div className="check-slip">
      <div className="world-kicker" style={{ color: meta.color }}>
        {info.kind === 'red' ? '红色检定 · 只有一次' : '白色检定 · 换个角度可以再试'}
      </div>
      <canvas ref={handRef} className="check-hand" aria-hidden="true" />
      {!result ? (
        <>
          <p className="world-prose text-sm mt-2">
            用<b style={{ color: meta.color }}>{meta.name}</b>（{info.skillValue}）掷两颗骰子，加起来要到 <b>{info.dc}</b>。大约
            <b> {Math.round(info.chance * 100)}%</b> 的把握。
          </p>
          <ul className="font-mono text-[11px] text-stone-600 mt-2 space-y-1">
            <li>成功：这一行记下，拿到它的词卡。</li>
            <li>失败：意志 −1，仍会留下一张模糊的卡；{info.kind === 'red' ? '这一行不能再试。' : '拿到新卡之后才能再试。'}</li>
            {line.alternative && (
              <li>
                不检定也行：把 {cardLabel(graph, line.alternative.cards[0])} 和 {cardLabel(graph, line.alternative.cards[1])} 放在一起联想，能得到同样的东西。
              </li>
            )}
          </ul>
          <div className="flex gap-2 mt-3">
            <button className="world-button flex-1 !py-2" onClick={onRoll}>
              落笔掷骰 · {line.minutes}′
            </button>
            <button className="world-button world-button-ghost !py-2" onClick={onCancel}>
              先不
            </button>
          </div>
        </>
      ) : (
        <div className="mt-2">
          <div className="check-dice">
            <span className="check-die">{d1}</span>
            <span>+</span>
            <span className="check-die">{d2}</span>
            <span>+ {result.skillValue} =</span>
            <b className="text-lg">{(d1 || 0) + (d2 || 0) + result.skillValue}</b>
            <span className="text-stone-500">/ {result.dc}</span>
            {!check!.rolling && (
              <span className="check-stamp ml-auto" style={{ color: result.success ? 'var(--pine)' : 'var(--accent)' }}>
                {result.success ? '成' : '败'}
              </span>
            )}
          </div>
          {!check!.rolling && (
            <button className="world-button w-full !py-2 mt-3" onClick={onDone}>
              记下
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** One chapter of the book: the cell's title card, its prose, and its cahier-des-charges checklist. */
const RoomPage: React.FC<RoomPageProps> = ({
  sheet,
  prose,
  generating,
  graph,
  armedLineId,
  check,
  onArm,
  onAct,
  onCheckDone,
  hour,
  stageMode,
  highlightedLineId,
  onHighlightLine,
  onStagePick,
  readOnly,
}) => {
  const consumedText = prose?.journal || [];
  const hotspots: StageHotspot[] = readOnly
    ? []
    : sheet.lines.map((line) => ({ lineId: line.id, status: line.status, kind: line.kind }));

  return (
    <article className="world-card chapter-card p-5 md:p-7">
      <header className="border-b border-stone-800/40 pb-3">
        <div className="chapter-numeral">{sheet.chapter ? `第 ${chapterNumeral(sheet.chapter)} 章` : '没有章节'}</div>
        <h2 className="chapter-title mt-1">{sheet.title}</h2>
        <div className="world-footnote mt-1">
          格 {sheet.cellId} · 清单 {sheet.done}/{sheet.total}
        </div>
      </header>

      <RoomStage
        input={{
          cellId: sheet.cellId,
          hour,
          hotspots,
          highlight: readOnly ? null : highlightedLineId,
          mode: stageMode,
        }}
        onPick={onStagePick}
      />

      <div className="world-prose mt-4 text-[15px]">
        {generating && !prose ? <p className="italic text-stone-500">瓦莱纳在回想这一格……</p> : <p>{prose?.text}</p>}
        {consumedText.map((entry, i) => {
          const body = entry.replace(/^>\s*/, '');
          const head = sheet.lines
            .flatMap((line) => [`失败 · ${line.label}`, line.label])
            .find((label) => body.startsWith(label));
          return (
            <p key={i} className="mt-3 border-l-2 border-stone-400 pl-3 text-[14px]">
              {head && <b className="font-bold">{head}。</b>}
              {head ? body.slice(head.length).trim() : body}
            </p>
          );
        })}
      </div>

      <section className="mt-5">
        <div className="world-kicker mb-1">这一格的清单{readOnly ? ' · 你不在这一格' : ''}</div>
        {sheet.lines.length === 0 && <p className="world-footnote py-2">这一格没有可做的事。看一眼就够了。</p>}
        {sheet.lines.map((line) => {
          const armed = armedLineId === line.id;
          const clickable = line.status === 'open' && !readOnly;
          const sub =
            line.status === 'locked' && line.lock
              ? lockReasonText(line.lock)
              : line.status === 'failed' && line.lock
                ? `失败过。${lockReasonText(line.lock)}`
                : line.status === 'open' && line.check
                  ? `${SKILL_META[line.check.skill].name} ${line.check.skillValue} 对 ${line.check.dc} · 约 ${Math.round(line.check.chance * 100)}%${line.alternative ? ' · 也可以联想' : ''}`
                  : line.status === 'open'
                    ? KIND_VERB[line.kind]
                    : null;
          return (
            <React.Fragment key={line.id}>
              <button
                type="button"
                className={`sheet-line is-${line.status} ${line.faux ? 'is-faux' : ''}`}
                disabled={!clickable || Boolean(check)}
                onClick={() => (line.kind === 'check' ? onArm(armed ? null : line.id) : onAct(line))}
                onMouseEnter={() => onHighlightLine(line.id)}
                onMouseLeave={() => onHighlightLine(null)}
                onFocus={() => onHighlightLine(line.id)}
                onBlur={() => onHighlightLine(null)}
              >
                <span className="sheet-mark">{MARK[line.status][line.kind]}</span>
                <span className="sheet-label">{line.label}</span>
                <span className="sheet-min">{line.status === 'open' ? `${line.minutes}′` : ''}</span>
                {sub && <span className="sheet-sub">{sub}</span>}
                {line.faux && <span className="sheet-sub" style={{ color: 'var(--accent)' }}>Faux · 这一行写的是假的。</span>}
                {line.yielded.length > 0 && (
                  <span className="sheet-sub">
                    {line.yielded.map((id) => (
                      <CardChip key={id} graph={graph} id={id} />
                    ))}
                  </span>
                )}
              </button>
              {line.kind === 'check' && (armed || check?.lineId === line.id) && (
                <CheckSlip
                  line={line}
                  graph={graph}
                  check={check?.lineId === line.id ? check : null}
                  onRoll={() => onAct(line)}
                  onCancel={() => onArm(null)}
                  onDone={onCheckDone}
                />
              )}
            </React.Fragment>
          );
        })}
        {sheet.manque && (
          <div className="sheet-manque">
            <span className="sheet-manque-rule" />
            <span>Manque · 这一页永远缺一行。</span>
          </div>
        )}
      </section>
    </article>
  );
};

export default RoomPage;
