"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { setStage } from "@/lib/actions/opportunities";
import {
  CATEGORY_META,
  STAGES,
  STAGE_META,
  type Category,
  type Stage,
} from "@/lib/domain/types";
import { formatDay, urgencyOf } from "@/lib/domain/dates";
import { UrgencyDot, URGENCY_TEXT } from "@/components/ui";
import { cn } from "@/lib/utils";

export type BoardCard = {
  id: string;
  title: string;
  company: string | null;
  category: Category;
  stage: Stage;
  score: number | null;
  nextFollowUpAt: string | null;
  deadline: string | null;
  isMock: boolean;
};

const COLUMN_ACCENT: Record<Stage, string> = {
  sourced: "bg-[#3a3a45]",
  researching: "bg-[#4a4a58]",
  qualified: "bg-accent/70",
  ready: "bg-accent",
  sent: "bg-cat-job",
  followup: "bg-duetoday",
  response: "bg-good",
  interview: "bg-good",
  won: "bg-good",
  lost: "bg-[#4a2029]",
};

/**
 * Drag-and-drop moves cards, but every card also carries a stage select — drag
 * is the fast path, not the only path, so touch and keyboard users are never
 * stuck and a failed drag never loses a move.
 */
export function PipelineBoard({ cards }: { cards: BoardCard[] }) {
  const [, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);

  const [board, applyMove] = useOptimistic(
    cards,
    (state: BoardCard[], move: { id: string; stage: Stage }) =>
      state.map((card) => (card.id === move.id ? { ...card, stage: move.stage } : card)),
  );

  const move = (id: string, stage: Stage) => {
    const card = board.find((item) => item.id === id);
    if (!card || card.stage === stage) return;
    startTransition(async () => {
      applyMove({ id, stage });
      await setStage(id, stage);
    });
  };

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-3 -mx-1 px-1">
      {STAGES.map((stage) => {
        const column = board.filter((card) => card.stage === stage);
        const isOver = over === stage;

        return (
          <section
            key={stage}
            onDragOver={(event) => {
              event.preventDefault();
              if (over !== stage) setOver(stage);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setOver((current) => (current === stage ? null : current));
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/plain") || dragging;
              setOver(null);
              setDragging(null);
              if (id) move(id, stage);
            }}
            className={cn(
              "w-[228px] shrink-0 rounded-[10px] border bg-surface flex flex-col transition-colors",
              isOver ? "border-accent bg-[#12101f]" : "border-line",
            )}
          >
            <header className="px-2.5 py-2 border-b border-line flex items-center gap-2">
              <span className={cn("h-[3px] w-4 rounded-full shrink-0", COLUMN_ACCENT[stage])} />
              <h2 className="text-[11px] font-semibold tracking-tight flex-1 truncate">
                {STAGE_META[stage].short}
              </h2>
              <span className="num text-[10.5px] text-ink-faint">{column.length}</span>
            </header>

            <div className="p-1.5 flex flex-col gap-1.5 min-h-[90px] max-h-[calc(100dvh-260px)] overflow-y-auto">
              {column.length === 0 ? (
                <p className="text-[11px] text-ink-faint/70 text-center py-5 px-2 leading-snug">
                  {isOver ? "Drop here" : "Empty"}
                </p>
              ) : (
                column.map((card) => (
                  <Card
                    key={card.id}
                    card={card}
                    dragging={dragging === card.id}
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/plain", card.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDragging(card.id);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onMove={(next) => move(card.id, next)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function Card({
  card,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: BoardCard;
  dragging: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onMove: (stage: Stage) => void;
}) {
  const urgency = urgencyOf(card.nextFollowUpAt);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-md border border-line bg-canvas px-2 py-2 cursor-grab active:cursor-grabbing transition-opacity",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="text-[11px] leading-[15px] shrink-0" aria-hidden title={CATEGORY_META[card.category].label}>
          {CATEGORY_META[card.category].icon}
        </span>
        <Link
          href={`/opportunities/${card.id}`}
          className="text-[11.5px] leading-[15px] flex-1 min-w-0 hover:text-accent-hot transition-colors line-clamp-2"
          draggable={false}
        >
          {card.title}
        </Link>
        {card.score !== null ? (
          <span
            className={cn(
              "num text-[10.5px] font-semibold shrink-0",
              card.score >= 80
                ? "text-overdue"
                : card.score >= 60
                  ? "text-duetoday"
                  : "text-ink-faint",
            )}
          >
            {card.score}
          </span>
        ) : null}
      </div>

      <p className="text-[10px] text-ink-faint mt-1 truncate flex items-center gap-1.5">
        <span className="truncate">{card.company ?? "Unassigned"}</span>
        {card.isMock ? (
          <span
            title="Seeded demo data"
            className="shrink-0 px-1 rounded-[3px] border border-dashed border-ink-faint/50 text-[8.5px] uppercase tracking-[0.08em] font-semibold"
          >
            Mock
          </span>
        ) : null}
      </p>

      {card.nextFollowUpAt || card.deadline ? (
        <div className="flex items-center gap-2 mt-1.5">
          {card.nextFollowUpAt ? (
            <span className={cn("flex items-center gap-1 text-[10px] num", URGENCY_TEXT[urgency])}>
              <UrgencyDot urgency={urgency} />
              {formatDay(card.nextFollowUpAt)}
            </span>
          ) : null}
          {card.deadline ? (
            <span className="text-[10px] text-ink-faint num ml-auto" title="Deadline">
              ⏳ {formatDay(card.deadline)}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Always-available fallback for the drag interaction. */}
      <select
        value={card.stage}
        onChange={(event) => onMove(event.target.value as Stage)}
        aria-label={`Move ${card.title} to another stage`}
        className="mt-1.5 w-full bg-transparent border border-transparent hover:border-line-strong focus:border-accent rounded-[4px] text-[10px] text-ink-faint hover:text-ink-muted px-1 py-0.5 cursor-pointer appearance-none transition-colors"
      >
        {STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {STAGE_META[stage].short}
          </option>
        ))}
      </select>
    </article>
  );
}
