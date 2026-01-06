export const PRODUCTS_API = "products";
export const COLLECTIONS_API = "collection"

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
  search: string;
  sort: string;
  initialFilter: string;
  filters: Filter[];
  initialSelectedVariants: Record<string, string>;
};

export type ProductsTableProps = {
  products: Product[];
  selectedVariants: Record<string, string>;
  siteLogo: string;
  loading: boolean;
  setSelectedVariants: React.Dispatch<React.SetStateAction<Record<string, string>>>;
};

export type ProductSearchProps = {
  search?: string;
  loading?: boolean;
  onSearch: (value: string) => void;
  setSearch: (value: string) => void;
};


export type SortOption = {
  key: string;
  label: string;
};

export type ProductSortProps = {
  value: string;
  options: SortOption[];
  loading?: boolean;
  onChange: (key: string) => void;
};

export type MobileFilterSortSheetProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;

  sortKey: string;
  filterType: string;
  filterGroupType: string;

  groups: Filter[];
  sortOptions: SortOption[];

  onApply: (next: {
    filterValue: string;
    filterGroupType: string;
    sortKey: string;
  }) => void;

  onClear: () => void;
  loading?: boolean;
};

export type ProductFiltersProps = {
  title: string;
  groups: Filter[];
  filterType?: string;
  loading: boolean;
  isFilterPending: boolean;
  applyFilter: (val: string, type: string) => void;
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

export type Filter = {
  title: string;
  filters?: string[];
  key: string;
};

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