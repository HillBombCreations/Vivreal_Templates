'use client';

import type { ComponentType } from 'react';
import { Navbar as RendererNavbar } from '@hillbombcreations/site-renderer';
import type { NavbarProps } from '@hillbombcreations/site-renderer';
import { useOptionalCart } from '@/contexts/CartContext';

// renderer-chrome compat: the published renderer (1.18.x) doesn't declare
// `chrome` on NavbarProps yet — dark-chrome ships with the studio-parity
// renderer release. Widen the prop type so the template compiles against
// 1.18.x; at runtime 1.18.x destructures known props only, so the extra prop
// is a no-op (navbar renders light chrome until the renderer is bumped).
// Remove this cast once the dependency declares `chrome` natively.
const NavbarWithChrome = RendererNavbar as ComponentType<
  NavbarProps & { chrome?: 'dark' | 'light' }
>;

/**
 * Client bridge for the renderer's <Navbar>. The server-side Navbar fetches
 * site data and passes serializable props; this wrapper supplies the cart
 * count + open handler from CartContext.
 *
 * The renderer renders the cart button only when `onCartClick` is provided
 * AND a products page exists in `pageConfigs` — so showcase sites (no cart
 * context / no products page) show no cart, matching intended 1.0 behavior.
 */
export default function NavbarChrome(
  props: Omit<NavbarProps, 'onCartClick' | 'cartCount'> & {
    chrome?: 'dark' | 'light';
  },
) {
  const cartCtx = useOptionalCart();
  const cartCount =
    cartCtx && cartCtx.cartHydrated
      ? Object.values(cartCtx.cart).reduce((sum, item) => sum + item.quantity, 0)
      : 0;
  const onCartClick = cartCtx ? () => cartCtx.setOpenCartMenu(true) : undefined;

  return <NavbarWithChrome {...props} onCartClick={onCartClick} cartCount={cartCount} />;
}
