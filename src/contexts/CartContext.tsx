import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getFromDB, setToDB, removeFromDB, clearDB } from "@/lib/indexDB";
import { Cart, CartContextValue } from "@/types/Cart";
const CART_EXPIRATION_HOURS = 24;
const MILLISECONDS_IN_HOUR = 60 * 60 * 1000;
const STORE_NAME = "cart";

const CartContext = createContext<CartContextValue | undefined>(undefined);

export default CartContext;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [openCartMenu, setOpenCartMenu] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCartFromDB() {
      const savedCart = (await getFromDB(STORE_NAME, "cart")) as
        | Cart
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

      setOpenCartMenu(Boolean(savedOpenCartMenu));

      if (savedCart && savedTimestamp != null) {
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
          setCart(null);
          setOpenCartMenu(false);
        } else {
          // If savedCart is an empty object, treat as null (optional)
          setCart(Object.keys(savedCart).length > 0 ? savedCart : null);
        }
      } else {
        setCart(null);
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

    const hasItems = cart != null && Object.keys(cart).length > 0;

    if (hasItems) {
      void setToDB(STORE_NAME, "cart", cart);
      void setToDB(STORE_NAME, "cartTimestamp", Date.now().toString());
    } else {
      void removeFromDB(STORE_NAME, "cart");
      void removeFromDB(STORE_NAME, "cartTimestamp");
    }
  }, [cart, cartHydrated]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      setCart,
      openCartMenu,
      setOpenCartMenu,
      cartHydrated,
    }),
    [cart, openCartMenu, cartHydrated]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCartContext = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCartContext must be used within a CartProvider");
  }
  return context;
};