/**
 * The item page's card facts and its own outbound link (V7 F-D1), and the one
 * function every item-page arm uses to place them under the renderer's hero.
 *
 * A `.ts` module built with `createElement`, not a `.tsx`, for one reason: the
 * repo's test runner (`node --experimental-strip-types`) cannot load JSX, and
 * the arms' composition has to be rendered by a committed test, not only by a
 * scratch harness. `DetailItemSummary.test.ts` renders `renderItemDetail` with
 * the renderer's real `DetailPageTemplate`; `[slug]/[itemId]/page.test.ts`
 * and the products renderer's test pin that the arms call it.
 *
 * What to draw is decided by `resolveDetailItemSummary`
 * (`src/lib/detail/itemSummary.ts`), where the link's safety, its label and
 * the owner's `fields` live. This module only places and draws the result.
 */
import { createElement, Fragment, type ComponentType, type CSSProperties, type ReactElement } from 'react';
import type { DetailPageConfig, DetailSection } from '@hillbombcreations/site-renderer';
// Relative `.ts` paths: this module loads under the plain-Node runner, which
// resolves neither the `@/` alias nor extensionless specifiers.
import {
  resolveDetailItemSummary,
  splitAtHero,
  type DetailItemSummary as Summary,
  type SummaryInput,
} from '../../lib/detail/itemSummary.ts';

export type { DetailItemSummary as ItemSummary } from '../../lib/detail/itemSummary.ts';
import { inkOnAccentIfFailsAA } from '../../lib/theme/readableAccent.ts';

interface SummaryProps {
  summary: Summary;
  /** The site accent. Absent, the hero's own fallback, `#000000`. */
  accent?: string;
  /** The site's `text-inverse` token, measured against the accent for WCAG AA. */
  textInverse?: string;
  /** `detailPage.styleVariant === 'editorial'`: square corners, as the hero draws them. */
  editorial?: boolean;
}

/**
 * The facts, then the action button. The button copies the detail hero's own
 * action button (`DetailHero.js`, the `raw.link` + `raw.ctaLabel` arm): the
 * accent fill (`accent ?? '#000000'`), `var(--text-inverse, #ffffff)` ink, the
 * same classes. One departure: when the site's inverse ink measurably fails
 * WCAG AA on its accent, the ink that passes is used instead
 * (`inkOnAccentIfFailsAA`). An `http(s)` link opens in a new tab with
 * `noopener noreferrer`; `mailto:` and `tel:` stay in place.
 */
export function DetailItemSummary({ summary, accent, textInverse, editorial = false }: SummaryProps): ReactElement {
  const primary = accent ?? '#000000';
  const ink = inkOnAccentIfFailsAA(accent, textInverse) ?? 'var(--text-inverse, #ffffff)';
  // Cast: React's CSSProperties declares no custom properties, and the focus
  // ring reads `--tw-ring-color` (layout.tsx sets its font variables the same way).
  const buttonStyle = { background: primary, color: ink, '--tw-ring-color': primary } as CSSProperties;
  const { facts, action } = summary;
  return createElement(
    'section',
    { 'data-detail-item-summary': '', className: 'max-w-6xl mx-auto px-6 pb-8 flex flex-col gap-4' },
    ...facts.map((line, i) =>
      createElement(
        'p',
        { key: i, className: 'm-0 text-base', style: { color: 'var(--text-secondary, rgba(0,0,0,0.6))' } },
        line,
      ),
    ),
    action
      ? createElement(
          'a',
          {
            key: 'action',
            href: action.href,
            ...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
            'aria-label': action.ariaLabel,
            'data-detail-item-action': '',
            className: `inline-flex w-full sm:w-auto sm:self-start items-center justify-center ${editorial ? 'rounded-none' : 'rounded-xl'} px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`,
            style: buttonStyle,
          },
          action.label,
        )
      : null,
  );
}

/** The template props this module touches; everything else passes through untouched. */
interface TemplateProps {
  detailPage?: DetailPageConfig;
}

/**
 * The summary for one item page, decided on the SERVER: every arm calls this
 * in `page.tsx` and hands only the result (a few strings) to the render, so a
 * client component such as the product renderer never receives the site's
 * page configs to decide it itself.
 */
export function resolveItemSummary(
  input: Omit<SummaryInput, 'fields'> & { detailPage: DetailPageConfig | undefined },
): Summary | undefined {
  const { detailPage, ...rest } = input;
  return resolveDetailItemSummary({ ...rest, fields: detailPage?.fields });
}

export interface RenderItemDetailInput<P extends TemplateProps> {
  /** The renderer's `DetailPageTemplate` (passed in: its package root cannot load under plain Node). */
  Template: ComponentType<P>;
  /** Every prop the arm hands the template, `detailPage` included. */
  props: P;
  /** The format the template renders with. */
  format: string | undefined;
  /** The renderer's `resolveDetailSections`. */
  resolveSections: (format: string | undefined, config: DetailPageConfig | undefined) => DetailSection[];
  /** From `resolveItemSummary`. Absent: the single template render, unchanged. */
  summary?: Summary;
  accent?: string;
  textInverse?: string;
  /**
   * The product page is drawn by a look (`resolveProductPageShell` answered a
   * component). The look draws itself in the first look section of each
   * template instance, so the second instance drops those sections.
   */
  lookShell?: boolean;
}

/**
 * The template, with the summary directly under its hero when there is one to
 * draw. No summary returns the single template render with the very same
 * props object, so a page with no link and no facts is unchanged.
 *
 * Split into two template instances around the summary (`splitAtHero`). The
 * only state a template shares across sections is the product buy box, and
 * it lives inside the hero, whose inline sections stay in the first instance.
 * An empty half is never rendered, since `sections: []` would fall back to
 * the format's full default list.
 */
export function renderItemDetail<P extends TemplateProps>(input: RenderItemDetailInput<P>): ReactElement {
  const { Template, props, summary } = input;
  if (!summary) return createElement(Template, props);

  const block = createElement(DetailItemSummary, {
    summary,
    accent: input.accent,
    textInverse: input.textInverse,
    editorial: props.detailPage?.styleVariant === 'editorial',
  });
  const { before, after } = splitAtHero(input.resolveSections(input.format, props.detailPage), {
    lookShell: input.lookShell === true,
  });
  const part = (s: DetailSection[]) => createElement(Template, { ...props, detailPage: { ...props.detailPage, sections: s } });
  return createElement(
    Fragment,
    null,
    before.length > 0 ? part(before) : null,
    block,
    after.length > 0 ? part(after) : null,
  );
}
