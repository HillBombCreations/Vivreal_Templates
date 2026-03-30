'use client';

import type { ElementType, ReactNode } from 'react';

interface ItemLinkProps {
  href?: string;
  enabled?: boolean;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  LinkComponent?: ElementType;
}

export default function ItemLink({
  href,
  enabled = true,
  children,
  className,
  style,
  LinkComponent = 'a',
}: ItemLinkProps) {
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
