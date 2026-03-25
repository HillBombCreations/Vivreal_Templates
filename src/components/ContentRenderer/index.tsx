'use client';

import { ContentRenderer as BaseContentRenderer } from '@vivreal/site-renderer';
import type { ContentRendererProps } from '@vivreal/site-renderer';

export type { ContentRendererProps };

export default function ContentRenderer(props: ContentRendererProps) {
  return <BaseContentRenderer {...props} />;
}
