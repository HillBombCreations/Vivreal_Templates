"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSiteData } from "@/contexts/SiteDataContext";
const AUTO_HIDE_DURATION = 2500;

type AddedToCartToastProps = {
  itemAdded: boolean;
  setItemAdded?: (v: boolean) => void;
};

export default function AddedToCartToast({ itemAdded, setItemAdded }: AddedToCartToastProps) {
  const { toast } = useToast();
  const siteData = useSiteData();
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!itemAdded) return;

    const nextCount = count + 1;
    setCount(nextCount);

    toast({
      title: `Added to cart${nextCount > 1 ? ` (${nextCount})` : ""}`,
      description: "Item saved to your bag.",
      duration: AUTO_HIDE_DURATION,

      className: "border-0",
      style: {
        background: siteData?.siteDetails?.primary,
        color: siteData?.siteDetails?.["text-inverse"],
      },
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setItemAdded?.(false);
      setCount(0);
    }, AUTO_HIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemAdded]);

  return null;
}