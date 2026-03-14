"use client";

import { useCartContext } from "@/contexts/CartContext";
import CartDialog from "@/components/Navigation/CartDialog";

export default function CartDialogWrapper() {
  const { openCartMenu, setOpenCartMenu } = useCartContext();

  return (
    <CartDialog
      open={openCartMenu}
      onClose={() => setOpenCartMenu(false)}
    />
  );
}
