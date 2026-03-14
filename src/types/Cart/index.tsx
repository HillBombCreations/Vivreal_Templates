import type { Dispatch, SetStateAction } from "react";
import type { Product } from "../Products";

export interface CartItem {
    _id: string;
    quantity: number;
    name: string;
    price: string;
    priceID: string;
    imageUrl: string;
    variant: string;
    unit?: string;
}

export type Cart = Record<string, CartItem>;

export interface CartContextValue {
    cart: Cart;
    setCart: Dispatch<SetStateAction<Cart>>;
    openCartMenu: boolean;
    setOpenCartMenu: Dispatch<SetStateAction<boolean>>;
    cartHydrated: boolean;
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
