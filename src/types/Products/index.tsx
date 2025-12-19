/* eslint-disable @typescript-eslint/no-explicit-any */
export const PRODUCTS_API = "products";

export type Image = {
  name?: string;
  key?: string;
  type?: string;
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

export type Products = Record<string, any>;

// export type Products = {
//   _id: string;
//   title: string;
//   description: string;
//   link?: string;
//   productType?: string;
//   imageUrl?: string;
//   buttonLabel?: string;
// };