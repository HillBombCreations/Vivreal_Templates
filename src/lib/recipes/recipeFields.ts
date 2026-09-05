/**
 * Read the recipe-shaped fields off a collection object's stored values.
 *
 * A recipe is an ordinary `collection_object`: `objectValue` is `strict:false`
 * Mongo Mixed, so every value here is whatever the owner's CMS form wrote and
 * NOTHING guarantees a type. `ingredients` and `steps` are authored as plain
 * free-text lines (one per line, the way a baker writes them on a card), which
 * is also exactly the shape `recipeIngredient` wants.
 *
 * Every reader below is defensive on purpose rather than trusting the shape:
 *   - a `list` can arrive as `string[]`, as one newline-joined string (an
 *     owner who typed into a single box), or as `object[]` on a site whose
 *     rows were authored before the free-text decision;
 *   - a minutes field can arrive as a number OR the string a text input
 *     produces (`"45"`, `"45 mins"`);
 *   - anything unreadable is ABSENT, never `NaN` and never `"[object Object]"`.
 *
 * Pure and dependency-free so it runs under plain `node --test`.
 */

export interface RecipeFields {
  /** Authored ingredient lines, verbatim, empties dropped. */
  ingredients: string[];
  /** Authored step lines, verbatim, empties dropped. */
  steps: string[];
  /** Whole minutes, always > 0. Absent when unauthored, zero, or unreadable. */
  prepMinutes?: number;
  cookMinutes?: number;
  restMinutes?: number;
  /**
   * DERIVED: prep + cook + rest. Never read from stored data even if a
   * `totalTime` key exists, so it can never contradict its own parts.
   * Absent when all three parts are absent.
   */
  totalMinutes?: number;
  /** "1 loaf", "15 pieces". */
  recipeYield?: string;
  /** The short intro above the fold. */
  summary?: string;
}

/** The keys an object-shaped list row might carry its text under. */
const ROW_TEXT_KEYS = ['text', 'item', 'name', 'title', 'value'] as const;

/** A non-empty trimmed string, or undefined. */
function toText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** One list row → its display line, or undefined when there is nothing to show. */
function rowToLine(row: unknown): string | undefined {
  const direct = toText(row);
  if (direct) return direct;
  if (typeof row === 'number' && Number.isFinite(row)) return String(row);
  if (!row || typeof row !== 'object') return undefined;
  const rec = row as Record<string, unknown>;
  for (const key of ROW_TEXT_KEYS) {
    const text = toText(rec[key]);
    if (text) return text;
  }
  return undefined;
}

/**
 * A `list` field → its lines. Accepts an array of rows or a single
 * newline-separated string; anything else yields no lines at all.
 */
function toLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const row of value) {
      const line = rowToLine(row);
      if (line) out.push(line);
    }
    return out;
  }
  const single = toText(value);
  if (!single) return [];
  return single
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * A minutes field → whole positive minutes, or undefined.
 *
 * Zero is deliberately undefined rather than 0: a no-rest recipe must omit the
 * rising row and omit `restTime` from the structured data, and one absent
 * value reads the same to every consumer as three of them.
 */
function toMinutes(value: unknown): number | undefined {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return undefined;
    return Math.floor(value);
  }
  if (typeof value !== 'string') return undefined;
  // Leading digits only: a text input can carry "45 mins", and parsing the
  // whole string would reject it.
  const match = /^\s*(\d+)/.exec(value);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return parsed > 0 ? parsed : undefined;
}

export function readRecipeFields(
  raw: Record<string, unknown> | undefined | null,
): RecipeFields {
  const values = raw ?? {};

  const prepMinutes = toMinutes(values.prepTime);
  const cookMinutes = toMinutes(values.cookTime);
  const restMinutes = toMinutes(values.restTime);

  const parts = [prepMinutes, cookMinutes, restMinutes].filter(
    (part): part is number => part !== undefined,
  );

  return {
    ingredients: toLines(values.ingredients),
    steps: toLines(values.steps),
    ...(prepMinutes !== undefined ? { prepMinutes } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ...(restMinutes !== undefined ? { restMinutes } : {}),
    ...(parts.length
      ? { totalMinutes: parts.reduce((sum, part) => sum + part, 0) }
      : {}),
    ...(toText(values.yield) ? { recipeYield: toText(values.yield) } : {}),
    ...(toText(values.summary) ? { summary: toText(values.summary) } : {}),
  };
}
