export const PRODUCTS_API = "products";

export type Image = {
  name?: string;
  key?: string;
  type?: string;
};

export type FloatingCartDialogProps = {
  open: boolean;
  onClose: () => void;
  product: Product;
  quantity: number;
  cartCount: number;
  variant: string | null;
  originUrl: string;
};

export type ProductPageClientProps = {
  product: Product | null;
  originUrl: string;
};

export type ProductsPageProps = {
  products: Product[];
  initialFilter: string;
  filters: string[];
  initialSelectedVariants: Record<string, string>;
};

export type VariantRowProps = {
  product: Product;
  selectedVariants: Record<string, string>;
  setSelectedVariants: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export type ProductsData = {
  objectValue: {
    _id: string;
    title: string;
    description: string;
    link?: string;
    productType?: string;
    image?: Image;
    buttonLabel?: string;
  }
};

export type VariantFieldKey = "name" | "price" | "default_price" | "imageUrl" | "description";

type VariantMap<T = unknown> = Record<string, T>;
export type Variantable<T> = T | VariantMap<T>;

type VariantableStringKeys<T> = {
  [K in keyof T]-?: T[K] extends Variantable<string> ? K : never;
}[keyof T];

export type ProductVariantKey = VariantableStringKeys<Product>;

export type Product = {
  _id: string;
  name: Variantable<string>;
  price: Variantable<string>;
  description: Variantable<string>;
  imageUrl: Variantable<string>;
  link?: Variantable<string>;
  productType?: Variantable<string>;
  buttonLabel?: Variantable<string>;
  "filter-type": Variantable<string>;
  usingVariant: {
    name: string;
    values: string[];
  };
  default_price: Variantable<string>;

};