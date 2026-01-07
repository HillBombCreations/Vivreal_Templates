/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useState } from "react";
import { capitalizeString } from "@/lib/utils/utils";
import { ProductFiltersProps } from "@/types/Products";
import { ChevronDown } from "lucide-react";

export default function ProductFilters({
  groups,
  filterType,
  applyFilter,
  loading,
}: ProductFiltersProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpenGroups(
      (groups || []).reduce((acc, g, idx) => {
        acc[g.key] = idx === 0;
        return acc;
      }, {} as Record<string, boolean>)
    );
  }, [groups]);

  return (
    <aside className="lg:col-span-3">
      <div className="flex flex-col gap-4">
        {groups.map((group) => {
          const isOpen = !!openGroups[group.key];

          return (
            <div
              key={group.key}
              className="rounded-2xl border bg-white/70 backdrop-blur"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setOpenGroups((prev) => ({
                    ...prev,
                    [group.key]: !prev[group.key],
                  }))
                }
                className="
                  w-full flex cursor-pointer items-center justify-between
                  px-4 py-4 text-left
                  text-sm font-semibold
                  disabled:opacity-60 disabled:pointer-events-none
                "
                aria-expanded={isOpen}
              >
                <span>{group.title}</span>
                <ChevronDown
                  className={[
                    "h-4 w-4 text-black/50 transition-transform",
                    isOpen ? "rotate-180" : "rotate-0",
                  ].join(" ")}
                />
              </button>

              {isOpen ? (
                <div className="px-4 pb-4">
                  {group.filters?.length ? (
                    <div className="mt-1 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => applyFilter("", group.key)}
                        disabled={loading}
                        className={[
                          "text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition",
                          "inline-flex items-center gap-2",
                          "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
                        ].join(" ")}
                        style={{
                          color: !filterType ? "var(--text-inverse)" : "var(--text-primary)",
                          background: !filterType ? "var(--primary)" : "var(--surface)",
                        }}
                      >
                        All
                      </button>

                      {group.filters.map((t) => {
                        const active = t === filterType;

                        return (
                          <button
                            key={`${group.key}-${t}`}
                            type="button"
                            disabled={loading}
                            onClick={() => applyFilter(t, group.key)}
                            className={[
                              "text-left rounded-xl px-3 py-2 cursor-pointer text-sm font-semibold transition",
                              "inline-flex items-center gap-2",
                              "disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none",
                            ].join(" ")}
                            style={{
                              color: active ? "var(--text-inverse)" : "var(--text-primary)",
                              background: active ? "var(--primary)" : "var(--surface)",
                            }}
                          >
                            { capitalizeString(t) }
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-black/50">No filters</div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </aside>
  );
}