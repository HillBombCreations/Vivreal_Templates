"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSiteData } from "@/contexts/SiteDataContext";

const AUTO_HIDE_DURATION = 2500;

export default function AddedToCartToast({ addTick }: { addTick: number }) {
  const { toast } = useToast();
  const siteData = useSiteData();
  const [count, setCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (addTick <= 0) return;

    setCount((prev) => {
      const next = prev + 1;

      toast({
        title: `Added to cart${next > 1 ? ` (${next})` : ""}`,
        description: "Item saved to your bag.",
        duration: AUTO_HIDE_DURATION,
        className: "border-0",
        style: {
          background: siteData?.siteDetails?.primary,
          color: siteData?.siteDetails?.["text-inverse"],
        },
      });

      return next;
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setCount(0);
    }, AUTO_HIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [addTick, toast, siteData]);

  return null;
}