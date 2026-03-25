'use client';
import { jsx as _jsx } from "react/jsx-runtime";
export default function ItemLink({ href, enabled = true, children, className, style, LinkComponent = 'a', }) {
    if (href && enabled) {
        return (_jsx(LinkComponent, { href: href, className: className, style: style, children: children }));
    }
    return (_jsx("div", { className: className, style: style, children: children }));
}
