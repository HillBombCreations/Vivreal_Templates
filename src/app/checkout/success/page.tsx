import CheckoutSuccessClient from "@/components/Checkout/success";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return <CheckoutSuccessClient />;
}