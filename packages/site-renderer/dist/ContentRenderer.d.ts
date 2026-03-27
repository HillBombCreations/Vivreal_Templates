import type { ContentLayoutProps } from './types/ContentItem';
export interface ContentRendererProps extends ContentLayoutProps {
    /** Which layout to render — defaults to 'cards' */
    displayAs?: string;
    /** Optional section heading shown above the content */
    label?: string;
    /** Optional subtitle shown below the heading */
    subtitle?: string;
}
export default function ContentRenderer({ displayAs, label, subtitle, ...layoutProps }: ContentRendererProps): import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=ContentRenderer.d.ts.map