export { default as ShowsPageWrapper } from "./ShowsPageWrapper";
export { default as FormClient } from "./FormClient";
export { default as StaticPage } from "./StaticPage";
export { default as SubscribeClient } from "./SubscribeClient";
export { default as ProductsClient } from "./ProductsClient";
// MemberDetail + ProductDetailClient removed in v0.4.0 — replaced by
// `DetailPageTemplate` from `@hillbombcreations/site-renderer` rendered
// from `src/app/[slug]/[itemId]/DetailPageClient.tsx`.

export type PageFormat =
  | "shows"
  | "team"
  | "form"
  | "static"
  | "products"
  | "subscribe"
  | "standard";
