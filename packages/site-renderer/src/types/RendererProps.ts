import type { ElementType } from 'react';

export interface RendererConfig {
  LinkComponent?: ElementType;
  ImageComponent?: ElementType;
  previewMode?: boolean;
}
