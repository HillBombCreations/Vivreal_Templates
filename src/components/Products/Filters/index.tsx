import React from "react";
import { capitalizeString } from "@/lib/utils/utils";
import { ProductFiltersProps } from "@/types/Products";
import { Loader2 } from "lucide-react";

export default function ProductFilters({
  groups,
  filterType,
  applyFilter,
  loading = false,
}: ProductFiltersProps) {
  return (
    <aside className="lg:col-span-3">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div
            key={group.key}
            className="rounded-2xl border bg-white/70 backdrop-blur p-4"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{group.title}</div>
            </div>

            {group.filters?.length ? (
              <div className="mt-3 flex flex-col gap-2">
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
                  {loading && filterType === "" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      All
                    </>
                  ) : (
                    "All"
                  )}
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
                      {loading && active ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {capitalizeString(t)}
                        </>
                      ) : (
                        capitalizeString(t)
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 text-sm text-black/50">No filters</div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}