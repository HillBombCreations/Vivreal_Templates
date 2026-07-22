'use client';

import { usePathname } from 'next/navigation';
import { Navbar as RendererNavbar } from '@hillbombcreations/site-renderer';
import type { NavbarProps } from '@hillbombcreations/site-renderer';
import { useOptionalCart } from '@/contexts/CartContext';
import { normalizePageSlug, isPageAllowed } from '@hillbombcreations/site-renderer';

/**
 * Client bridge for the renderer's <Navbar>. The server-side Navbar fetches
 * site data and passes serializable props; this wrapper supplies the cart
 * count + open handler from CartContext.
 *
 * The renderer renders the cart button only when `onCartClick` is provided
 * AND a products page exists in `pageConfigs` — so showcase sites (no cart
 * context / no products page) show no cart, matching intended 1.0 behavior.
 *
 * It is also where the ANNOUNCEMENT PAGE GATE is applied. That has to happen in
 * a client component: the server `Navbar` is mounted from the root layout and
 * takes no props, so it has no idea which route is rendering — `usePathname()`
 * here is the only thing that does. Same reason `EmailPopup` self-gates.
 */
export default function NavbarChrome(
  props: Omit<NavbarProps, 'onCartClick' | 'cartCount'>,
) {
  const cartCtx = useOptionalCart();
  const pathname = usePathname();
  const cartCount =
    cartCtx && cartCtx.cartHydrated
      ? Object.values(cartCtx.cart).reduce((sum, item) => sum + item.quantity, 0)
      : 0;
  const onCartClick = cartCtx ? () => cartCtx.setOpenCartMenu(true) : undefined;

  // The Studio has always offered per-page targeting for the announcement bar
  // and NOTHING honored it — the renderer documents the gate as consumer-owned
  // and this wrapper passed the config straight through, so "Home only" showed
  // the bar site-wide. `fallback: true` keeps every site without an authored
  // gate byte-identical to today (absent ⇒ every page).
  const announcement =
    props.announcement && !isPageAllowed(
      props.announcement.pages,
      normalizePageSlug(pathname),
      true,
    )
      ? null
      : props.announcement;

  return (
    <RendererNavbar
      {...props}
      announcement={announcement}
      onCartClick={onCartClick}
      cartCount={cartCount}
    />
  );
}
