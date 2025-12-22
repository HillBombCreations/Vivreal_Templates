import { type Dispatch, type SetStateAction } from "react";
import { Product } from "../Products";
import { Businessinfo, SiteData } from "../SiteData";
export type FloatingCartDialog = {
  product: Product,
  selectedVariant: string | null,
  quantity: number,
  cart: Cart | null,
  setCart: (cart: Cart) => void,
  setAddedOpen: (flag: boolean) => void
};

export type CartDialogProps = {
  open: boolean;
  onClose?: () => void;
  siteData: SiteData;
  originUrl: string;
};

export type HandleCheckoutProps = {
  itemsArray: CartItem[];
  businessInfo: Businessinfo | null;
  originUrl: string;
  setOpenCartMenu: (flag: boolean) => void;
  setLoadingCheckout: (flag: boolean) => void;
};

export type AddedToCartToastProps = {
  itemAdded: boolean;
  setItemAdded?: (v: boolean) => void;
};

export type CartItem = {
  quantity: number;
  _id: string;
  name: string;
  price: string;
  priceID: string;
  imageUrl: string;
  variant: string | null;
};

export type Cart = Record<string, CartItem>;

export type CartContextValue = {
  cart: Cart | null;
  openCartMenu: boolean;
  setOpenCartMenu: Dispatch<SetStateAction<boolean>>;
  setCart: Dispatch<SetStateAction<Cart | null>>;
  cartHydrated: boolean;
};