'use client';

import { Navbar as RendererNavbar } from '@hillbombcreations/site-renderer';
import type { NavbarProps } from '@hillbombcreations/site-renderer';
import { useOptionalCart } from '@/contexts/CartContext';

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
  props: Omit<NavbarProps, 'onCartClick' | 'cartCount'>,
) {
  const cartCtx = useOptionalCart();
  const cartCount =
    cartCtx && cartCtx.cartHydrated
      ? Object.values(cartCtx.cart).reduce((sum, item) => sum + item.quantity, 0)
      : 0;
  const onCartClick = cartCtx ? () => cartCtx.setOpenCartMenu(true) : undefined;

  return <RendererNavbar {...props} onCartClick={onCartClick} cartCount={cartCount} />;
}
