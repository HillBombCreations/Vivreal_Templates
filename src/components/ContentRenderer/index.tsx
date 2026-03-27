'use client';

import { ContentRenderer as BaseContentRenderer } from '@hillbombcreations/site-renderer';
import type { ContentRendererProps } from '@hillbombcreations/site-renderer';

export type { ContentRendererProps };

export default function ContentRenderer(props: ContentRendererProps) {
  return <BaseContentRenderer {...props} />;
}
