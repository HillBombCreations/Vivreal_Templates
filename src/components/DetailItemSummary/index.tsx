import type { CSSProperties } from 'react';
import type { DetailItemSummary as Summary } from '@/lib/detail/itemSummary';

interface Props {
  summary: Summary;
  /** The site accent, as the renderer's detail hero fills its own action button. */
  accent?: string;
  /** `detailPage.styleVariant === 'editorial'`: square corners, as the hero draws them. */
  editorial?: boolean;
}

/**
 * The item page's card facts and its own outbound link (V7 F-D1), drawn
 * directly under the renderer's detail hero. Everything it shows is decided
 * by `resolveDetailItemSummary` (`@/lib/detail/itemSummary`), which is where
 * the link's safety, its label and the owner's `fields` choices live; this
 * only draws the result.
 *
 * The button copies the detail hero's own action button (`DetailHero.js`,
 * the `raw.link` + `raw.ctaLabel` arm): the accent fill, inverse ink, and the
 * same target rule, an `http(s)` link opens a new tab with
 * `noopener noreferrer`; `mailto:` and `tel:` stay in place.
 */
export function DetailItemSummary({ summary, accent, editorial = false }: Props) {
  const primary = accent ?? 'var(--primary)';
  const { facts, action } = summary;
  // Cast: React's CSSProperties declares no custom properties, and the focus
  // ring reads `--tw-ring-color` (layout.tsx sets its font variables the same way).
  const buttonStyle = { background: primary, color: 'var(--text-inverse, #ffffff)', '--tw-ring-color': primary } as CSSProperties;
  return (
    <section data-detail-item-summary="" className="max-w-6xl mx-auto px-6 pb-8 flex flex-col gap-4">
      {facts.map((line, i) => (
        <p key={i} className="m-0 text-base" style={{ color: 'var(--text-secondary, rgba(0,0,0,0.6))' }}>
          {line}
        </p>
      ))}
      {action && (
        <a
          href={action.href}
          {...(action.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          data-detail-item-action=""
          className={`inline-flex w-full sm:w-auto sm:self-start items-center justify-center ${editorial ? 'rounded-none' : 'rounded-xl'} px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2`}
          style={buttonStyle}
        >
          {action.label}
        </a>
      )}
    </section>
  );
}
