"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSiteData } from "@/contexts/SiteDataContext";

const AUTO_HIDE_DURATION = 2500;

export default function AddedToCartToast({ addTick }: { addTick: number }) {
  const { toast } = useToast();
  const siteData = useSiteData();

  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toastStyle = useMemo(
    () => ({
      background: siteData?.primary ?? "var(--primary,#365b99)",
      color: siteData?.["text-inverse"] ?? "#fff",
    }),
    [siteData]
  );

  useEffect(() => {
    if (addTick <= 0) return;

    countRef.current += 1;
    const next = countRef.current;

    toast({
      title: `Added to cart${next > 1 ? ` (${next})` : ""}`,
      description: "Item saved to your bag.",
      duration: AUTO_HIDE_DURATION,
      className: "border-0",
      style: toastStyle,
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      countRef.current = 0;
    }, AUTO_HIDE_DURATION);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [addTick, toast, toastStyle]);

  return null;
}
