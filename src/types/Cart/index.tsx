import type { Dispatch, SetStateAction } from "react";
import type { Product } from "../Products";
import type { StoredPromoCode } from "@/lib/promoCodeRestore";

export interface CartItem {
    _id: string;
    quantity: number;
    name: string;
    price: string;
    priceID: string;
    imageUrl: string;
    variant: string;
    unit?: string;
    /**
     * QA-W2-1: this line's stock when it is tracked (a plain count, or the
     * chosen size's count). Absent means untracked, so no cap. See
     * lib/cartStock.ts.
     */
    stock?: number;
    /**
     * F385 (SW-B25 option A): `stock` is ONE count shared by every line of
     * this product (`_id`), a product priced per option (Stripe) or per size
     * (Square, F393) with a single number. The bag caps the SUM of those lines
     * at it. Absent: `stock` is this line's own.
     */
    sharedStock?: true;
    /**
     * D-P9-5 (S6): the product has one checkout id and `stock` counted per
     * option, so `stock` is this line's option's count and checkout is sent
     * `variant` as the line's `option` (S2), without which it refuses the line.
     */
    optionStock?: true;
}

export type Cart = Record<string, CartItem>;

export interface CartContextValue {
    cart: Cart;
    setCart: Dispatch<SetStateAction<Cart>>;
    openCartMenu: boolean;
    setOpenCartMenu: Dispatch<SetStateAction<boolean>>;
    cartHydrated: boolean;
    /** TB-6: the applied promo code, persisted with the cart. See lib/promoCodeRestore.ts. */
    promoCode: StoredPromoCode | null;
    setPromoCode: Dispatch<SetStateAction<StoredPromoCode | null>>;
}

export interface CartDialogProps {
    open: boolean;
    onClose?: () => void;
}

export interface FloatingCartDialogProps {
    open: boolean;
    onClose: () => void;
    product: Product;
    quantity: number;
    cartCount: number;
    variant: string | null;
}
