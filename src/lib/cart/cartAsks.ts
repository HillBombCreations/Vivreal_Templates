/**
 * What the cart asks the shopper itself (release C, Square parity:
 * vivreal-hq docs/projects/next-release-C/design-square-parity.md 3.3, 4.3,
 * FP1.4, FP1.5 and its fix pass of 2026-11-21; mockup M-SQ-1).
 *
 * - SQP-T1, the product questions on a SQUARE shop. Square's payment page
 *   cannot ask them the way the owner set them, so the cart does: one box per
 *   question, under the items, for the first three distinct products in cart
 *   order whose quote line carries a question (VR_Client_API's `cartQuote`,
 *   SV-SQ10, the same rule its checkout asks by). The answers ride checkout as
 *   `answers: [{ line, answer }]` (SV-SQ11), `line` the product's first cart
 *   line id. A Stripe shop has no boxes: Stripe's own page asks.
 * - SQP-T2, the newsletter tick, on a Stripe or a Square shop whose owner
 *   turned on "ask to join the list" (`cart.askToJoinList`): one box above
 *   Checkout that always starts unticked; ticked sends `joinList: true`
 *   (SV-SQ13). Owners' answer `decisions.md:1170`: Vivreal's tick on both.
 *
 * Every rule is checked again by VR_Client_API at checkout. Pure, so
 * `node --test` decides what the cart draws and sends.
 */
import type { CartQuote } from '../cartQuote.ts';

/** WSQ-11, the answer box placeholder. */
export const ANSWER_PLACEHOLDER = 'Your answer';
/** WSQ-12, beside an optional question. */
export const QUESTION_OPTIONAL = 'Optional';
/** WSQ-13, under a required box left empty when Checkout is pressed. */
export const ANSWER_NEEDED = 'Answer this question to check out.';
/** WSQ-19, under the newsletter box. */
export const JOIN_BOX_LINE = 'You can unsubscribe any time.';

/** SV-SQ11: an answer is kept to 255 characters (VR_Client_API takes up to 300 in). */
export const ANSWER_MAX = 255;
/** F381's rule: at most three questions per order. */
export const QUESTIONS_MAX = 3;

export interface CartQuestion {
  /** The product the question belongs to. */
  productId: string;
  /** The product's first cart line id (its checkout price id), the `line` the answer is sent with. */
  line: string;
  /** The owner's question, as written. */
  question: string;
  required: boolean;
}

type CartLine = { _id?: string; priceID?: string };

/**
 * SQP-T1: the questions the cart asks, in cart order. Only on a Square shop,
 * and only from the quote (a failed quote asks nothing; checkout's
 * `QUESTION_REQUIRED` backstop re-quotes). A product with several lines (sizes)
 * is asked once, its answer sent with its first line.
 */
export function cartQuestions(items: readonly CartLine[], quote: CartQuote | null, provider: unknown): CartQuestion[] {
  if (provider !== 'square' || !quote) return [];
  const byProduct = new Map<string, { line: string; question: string | null; required: boolean }>();
  for (const item of items) {
    if (!item._id || !item.priceID) continue;
    const asked = quote.get(item.priceID)?.question ?? null;
    const entry = byProduct.get(item._id);
    if (!entry) {
      byProduct.set(item._id, { line: item.priceID, question: asked?.question ?? null, required: asked?.required === true });
    } else if (entry.question === null && asked) {
      entry.question = asked.question;
      entry.required = asked.required;
    }
  }
  const out: CartQuestion[] = [];
  for (const [productId, entry] of byProduct) {
    if (entry.question === null) continue;
    out.push({ productId, line: entry.line, question: entry.question, required: entry.required });
    if (out.length === QUESTIONS_MAX) break;
  }
  return out;
}

/** The first required question with no answer, or null when Checkout may go. */
export function unansweredRequired(questions: readonly CartQuestion[], answers: Readonly<Record<string, string>>): CartQuestion | null {
  return questions.find((q) => q.required && !(answers[q.productId] ?? '').trim()) ?? null;
}

/** `answers` for the checkout body: each question answered, trimmed and cut to 255. A blank answer is not sent. */
export function checkoutAnswers(
  questions: readonly CartQuestion[],
  answers: Readonly<Record<string, string>>,
): Array<{ line: string; answer: string }> {
  const out: Array<{ line: string; answer: string }> = [];
  for (const q of questions) {
    const answer = (answers[q.productId] ?? '').trim().slice(0, ANSWER_MAX);
    if (answer) out.push({ line: q.line, answer });
  }
  return out;
}

/**
 * SQP-T2 (T-SQN-1): whether the cart shows the newsletter box: the owner's
 * switch on, a shop that takes payments through Stripe or Square, and a
 * business name to put in the words (Studio's preview needs the same, so a
 * shop with no name is asked in neither place).
 */
export function showsJoinBox(settings: { askToJoinList: boolean }, provider: unknown, businessName: unknown): boolean {
  return (
    settings.askToJoinList &&
    (provider === 'stripe' || provider === 'square') &&
    typeof businessName === 'string' &&
    businessName.trim().length > 0
  );
}

/**
 * WSQ-18 with its fill rule (T-SQN-2), the same as the portal's
 * `joinBoxLabel`: "Email me news and offers from {business name}." A name that
 * already ends in ".", "!" or "?" gets no second mark.
 */
export function joinBoxLabel(businessName: string): string {
  const name = businessName.trim();
  return /[.!?]$/.test(name) ? `Email me news and offers from ${name}` : `Email me news and offers from ${name}.`;
}
