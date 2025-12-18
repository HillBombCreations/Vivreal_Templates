import {
  createContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { getFromDB, setToDB, removeFromDB, clearDB } from "@/lib/indexDB";

const CART_EXPIRATION_HOURS = 24;
const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;
const STORE_NAME = 'cart';

export type CartItems = Record<string, unknown>;

export type CartContextValue = {
  cartItems: CartItems;
  openCartMenu: boolean;
  setOpenCartMenu: Dispatch<SetStateAction<boolean>>;
  setCartItems: Dispatch<SetStateAction<CartItems>>;
};

const CartContext = createContext<CartContextValue>({
  cartItems: {},
  openCartMenu: false,
  setOpenCartMenu: () => {
    /* noop */
  },
  setCartItems: () => {
    /* noop */
  },
});

export default CartContext;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItems>({});
  const [openCartMenu, setOpenCartMenu] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCartFromDB() {
      const savedCartItems = (await getFromDB(STORE_NAME, "cartItems")) as
        | CartItems
        | null
        | undefined;
      const savedTimestamp = (await getFromDB(STORE_NAME, "cartTimestamp")) as
        | string
        | number
        | null
        | undefined;
      const savedOpenCartMenu = (await getFromDB(STORE_NAME, "openCartMenu")) as
        | boolean
        | null
        | undefined;

      if (!mounted) return;

      if (savedCartItems && savedTimestamp != null) {
        const ts =
          typeof savedTimestamp === "number"
            ? savedTimestamp
            : Number(savedTimestamp);

        const timeElapsed = Date.now() - ts;

        if (
          Number.isFinite(timeElapsed) &&
          timeElapsed > CART_EXPIRATION_HOURS * MILLISECONDS_IN_HOUR
        ) {
          await clearDB(STORE_NAME);
          if (!mounted) return;
          setCartItems({});
          setOpenCartMenu(false);
        } else {
          setCartItems(savedCartItems);
          setOpenCartMenu(Boolean(savedOpenCartMenu));
        }
      }

      setCartHydrated(true);
    }

    void loadCartFromDB();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!cartHydrated) return;
    void setToDB(STORE_NAME, "openCartMenu", openCartMenu);
  }, [openCartMenu, cartHydrated]);

  useEffect(() => {
    if (!cartHydrated) return;

    if (Object.keys(cartItems).length > 0) {
      void setToDB(STORE_NAME, "cartItems", cartItems);
      void setToDB(STORE_NAME, "cartTimestamp", Date.now().toString());
    } else {
      void removeFromDB(STORE_NAME, "cartItems");
      void removeFromDB(STORE_NAME, "cartTimestamp");
    }
  }, [cartItems, cartHydrated]);

  const value = useMemo<CartContextValue>(
    () => ({ cartItems, setCartItems, openCartMenu, setOpenCartMenu }),
    [cartItems, openCartMenu]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}