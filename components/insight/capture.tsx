"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, FileUp, Sparkles, X } from "lucide-react";
import { ingestPastedConversation, runExtraction } from "@/lib/actions/conversations";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/shared";

const ACCEPTED = ".txt,.md,.markdown,.json,text/plain,text/markdown,application/json";
const MAX_FILE_BYTES = 8_000_000;

/**
 * Capture by paste or file. This is not a fallback for the extension — it is
 * how the pipeline stays usable with no browser plugin installed, and how a
 * platform data export gets in.
 */
export function CaptureBox({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [seen, setSeen] = useState<ActionResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    ingestPastedConversation,
    null,
  );

  // A fresh result means a save landed; clear the box so the next paste is not
  // appended to the last one.
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setText("");
      setFileName(null);
    }
  }

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/conversations/${state.id}`);
  }, [state, router]);

  const loadFile = async (file: File) => {
    setFileError(null);
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`${file.name} is larger than 8 MB.`);
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setFileError(`Could not read ${file.name}.`);
    }
  };

  return (
    <form ref={formRef} action={formAction} className="px-4 py-3.5 grid gap-3">
      <Field
        label="Conversation"
        htmlFor="capture-text"
        hint="Paste a transcript, or drop a .md/.json file. A ChatGPT export works as-is."
      >
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) void loadFile(file);
          }}
          className="relative"
        >
          <Textarea
            id="capture-text"
            name="text"
            rows={9}
            required
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"You: I've been thinking about building a tool that…\nChatGPT: That's interesting because…"}
            className="font-mono text-[12px] leading-relaxed"
          />
          {dragging ? (
            <div className="absolute inset-0 rounded-[6px] border-2 border-dashed border-accent bg-accent/10 grid place-items-center pointer-events-none">
              <span className="text-[12.5px] text-accent-hot font-medium">Drop to load</span>
            </div>
          ) : null}
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-[6px] cursor-pointer",
            "border border-line-strong text-[12px] text-ink-muted hover:bg-hover hover:text-ink transition-colors",
          )}
        >
          <FileUp size={13} />
          Upload file
          <input
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void loadFile(file);
              event.target.value = "";
            }}
          />
        </label>

        {fileName ? (
          <span className="inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-[6px] bg-raised border border-line text-[11.5px] text-ink-muted">
            {fileName}
            <button
              type="button"
              onClick={() => {
                setFileName(null);
                setText("");
              }}
              aria-label="Clear file"
              className="text-ink-faint hover:text-ink"
            >
              <X size={12} />
            </button>
          </span>
        ) : null}

        <div className="w-full sm:w-[220px] sm:ml-auto">
          <Input name="title" placeholder="Title (optional)" autoComplete="off" />
        </div>
      </div>

      {fileError ? (
        <p className="flex items-start gap-2 text-[12px] text-bad">
          <AlertCircle size={13} className="mt-px shrink-0" />
          {fileError}
        </p>
      ) : null}

      {state?.error ? (
        <p className="flex items-start gap-2 text-[12px] text-bad">
          <AlertCircle size={13} className="mt-px shrink-0" />
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <p className="text-[11.5px] text-ink-faint mr-auto leading-snug">
          {aiConfigured
            ? "Saved first, read second — nothing is lost if extraction fails."
            : "Saved and searchable. Set GEMINI_API_KEY to extract ideas from it."}
        </p>
        <SubmitButton pendingLabel="Saving…" disabled={!text.trim()}>
          Save conversation
        </SubmitButton>
      </div>
    </form>
  );
}

/**
 * Runs extraction over everything still pending. Separate from capture so a
 * slow or failing model never blocks getting the conversation in.
 */
export function ExtractButton({
  pending,
  aiConfigured,
}: {
  pending: number;
  aiConfigured: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(runExtraction, null);

  if (!pending) {
    return state?.ok ? (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-good">
        <Check size={13} /> {state.id}
      </span>
    ) : null;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      {state?.error ? (
        <span className="text-[11.5px] text-bad max-w-[280px] truncate" title={state.error}>
          {state.error}
        </span>
      ) : null}
      <SubmitButton
        pendingLabel="Reading…"
        disabled={!aiConfigured}
        title={aiConfigured ? undefined : "Set GEMINI_API_KEY to enable extraction"}
      >
        <Sparkles size={13} />
        Read {pending} conversation{pending === 1 ? "" : "s"}
      </SubmitButton>
    </form>
  );
}

/** Re-runs one conversation that failed. */
export function RetryExtraction({ id }: { id: string }) {
  const [, formAction] = useActionState<ActionResult | null, FormData>(runExtraction, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="xs">
        Retry
      </Button>
    </form>
  );
}
