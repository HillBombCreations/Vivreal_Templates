import type { Dispatch, SetStateAction } from "react";

export interface CartItem {
    _id: string;
    quantity: number;
    name: string;
    price: string;
    priceID: string;
    imageUrl: string;
    variant: string;
}

export type Cart = Record<string, CartItem>;

export interface CartContextValue {
    cart: Cart;
    setCart: Dispatch<SetStateAction<Cart>>;
    openCartMenu: boolean;
    setOpenCartMenu: Dispatch<SetStateAction<boolean>>;
    cartHydrated: boolean;
}
