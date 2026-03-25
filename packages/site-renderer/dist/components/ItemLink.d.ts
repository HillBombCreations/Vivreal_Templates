import type { ElementType, ReactNode } from 'react';
interface ItemLinkProps {
    href?: string;
    enabled?: boolean;
    children: ReactNode;
    className?: string;
    style?: React.CSSProperties;
    LinkComponent?: ElementType;
}
export default function ItemLink({ href, enabled, children, className, style, LinkComponent, }: ItemLinkProps): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ItemLink.d.ts.map