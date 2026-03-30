'use client';

import type { ReactNode } from 'react';
import { useSiteRenderer } from '../context/SiteRendererContext';

interface ItemLinkProps {
  href?: string;
  enabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function ItemLink({
  href,
  enabled = true,
  children,
  className,
  style,
}: ItemLinkProps) {
  const { LinkComponent } = useSiteRenderer();

  if (href && enabled) {
    return (
      <LinkComponent href={href} className={className} style={style}>
        {children}
      </LinkComponent>
    );
  }
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
