export { default as ShowPageClient } from "./ShowPageClient";
export { default as AboutClient } from "./AboutClient";
export { default as FormClient } from "./FormClient";
export { default as StaticPage } from "./StaticPage";
export { default as MemberDetail } from "./MemberDetail";
export { default as SubscribeClient } from "./SubscribeClient";
export { default as ProductsClient } from "./ProductsClient";
export { default as ProductDetailClient } from "./ProductDetailClient";

export type PageFormat =
  | "shows"
  | "team"
  | "form"
  | "static"
  | "products"
  | "subscribe"
  | "standard";
