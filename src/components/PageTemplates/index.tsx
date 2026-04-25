export { default as ShowsPageWrapper } from "./ShowsPageWrapper";
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
