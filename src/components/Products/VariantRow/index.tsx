"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useSiteData } from "@/contexts/SiteDataContext";
import { VariantRowProps } from "@/types/Products";

export default function VariantRow({
  product,
  selectedVariants,
  setSelectedVariants,
}: VariantRowProps) {
  const siteData = useSiteData();
  const primary = siteData?.siteDetails?.primary ?? "var(--primary,#365b99)";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(
    product?.usingVariant?.values?.length || 0
  );

  const variants: string[] = product?.usingVariant?.values || [];

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const containerWidth = el.offsetWidth;
      let total = 0;
      let count = 0;

      const children = Array.from(el.children) as HTMLElement[];

      for (const child of children) {
        const w = child.offsetWidth + 6;
        if (total + w <= containerWidth) {
          total += w;
          count++;
        } else {
          break;
        }
      }

      if (count < variants.length) setVisibleCount(Math.max(0, count - 1));
      else setVisibleCount(count);
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
  }, [variants.length]);

  return (
    <div
      ref={containerRef}
      className="flex flex-nowrap justify-center gap-x-1.5 overflow-hidden w-full pb-2"
    >
      {variants.slice(0, visibleCount).map((variant) => {
        const isSelected = selectedVariants?.[product._id] === variant;

        return (
          <button
            key={variant}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedVariants((prev) => ({
                ...prev,
                [product._id]: variant,
              }));
            }}
            className={[
              "h-6 px-2 rounded-full cursor-pointer text-[11px] font-semibold whitespace-nowrap",
              "border transition active:scale-[0.98]",
              "max-w-[140px] truncate",
            ].join(" ")}
            style={{
              background: isSelected ? primary : "transparent",
              color: isSelected ? "white" : primary,
              borderColor: isSelected ? "rgba(0,0,0,0.10)" : primary,
            }}
            aria-pressed={isSelected}
          >
            {variant}
          </button>
        );
      })}

      {variants.length > visibleCount && (
        <div
          className="h-6 px-2 rounded-full text-[11px] font-semibold whitespace-nowrap border flex items-center"
          style={{
            color: primary,
            borderColor: primary,
            opacity: 0.9,
          }}
          aria-hidden="true"
        >
          +{variants.length - visibleCount}
        </div>
      )}
    </div>
  );
}