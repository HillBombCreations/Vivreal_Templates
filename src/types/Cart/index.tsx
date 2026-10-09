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
