import type { InsightKind, LinkKind, Movement, Stance } from "@/lib/domain/archaeology";

/**
 * The seam between this app and whichever model is doing the reading.
 *
 * There is one implementation (Gemini) because one key is configured, and
 * building three would be inventing work. What matters is that nothing above
 * this line imports a vendor SDK or knows a request shape, so a second provider
 * is a new file rather than a refactor.
 */
export interface AIProvider {
  readonly id: string;
  readonly model: string;
  /** Pull structured entities out of a slice of conversation. */
  extract(input: ExtractInput): Promise<ExtractResult>;
}

export type ExtractInput = {
  /** Conversation title. A weak hint: platforms rarely update it as a chat drifts. */
  title: string;
  /** The chunk, already rendered as `role: content` lines. */
  transcript: string;
  /**
   * Only the person's own turns, concatenated.
   *
   * Evidence is verified against this rather than the whole transcript, so an
   * insight can never be backed by something the assistant said. Without it the
   * corpus quietly fills with the model's suggestions presented back as the
   * user's own thinking — which would make "what have I been thinking about?"
   * answer with someone else's ideas.
   */
  userTranscript: string;
  /** When the conversation happened, so "tomorrow" can become a real date. */
  occurredAt: Date;
};

export type ExtractedEntity = {
  kind: InsightKind;
  title: string;
  summary: string | null;
  detail: string | null;
  stance: Stance;
  confidence: number;
  /** Quoted from the source. The evidence for this entity existing at all. */
  evidence: string;
  movement: Movement | null;
  /** Commitments only: when the user said it would happen. */
  dueDate: string | null;
};

export type ExtractedRelationship = {
  from: string;
  to: string;
  kind: LinkKind;
  reason: string | null;
};

export type ExtractResult = {
  entities: ExtractedEntity[];
  relationships: ExtractedRelationship[];
};

export class AIUnavailableError extends Error {}
