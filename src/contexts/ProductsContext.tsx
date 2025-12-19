/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createContext,
  useEffect,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { setToDB, removeFromDB } from "@/lib/indexDB";

const STORE_NAME = "products";

export type Products = Record<string, any>[];

export type ProductContextValue = {
  products: Products;
  setProducts: Dispatch<SetStateAction<Products>>;
};

const ProductsContext = createContext<ProductContextValue>({
  products: [],
  setProducts: () => {
  },
});

export default ProductsContext;

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
  const [products, setProducts] = useState<Products>([]);

  useEffect(() => {
    if (Object.keys(products).length > 0) {
      void setToDB(STORE_NAME, "products", products);
    } else {
      void removeFromDB(STORE_NAME, "products");
    }
  }, [products]);

  const value = useMemo<ProductContextValue>(
    () => ({ products, setProducts }),
    [products]
  );

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export const useProductsContext = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useSiteData must be used within a SiteDataProvider');
  }
  return context;
};