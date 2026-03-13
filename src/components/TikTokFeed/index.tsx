"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { TikTokOEmbed } from "@/types/Social";
import type { SiteData } from "@/types/SiteData";

interface TikTokEmbedData {
  caption: string;
  permalink: string | null;
  oembed: TikTokOEmbed | null;
}

interface TikTokFeedProps {
  posts: TikTokEmbedData[];
  siteData: SiteData;
  heading: string;
}

export default function TikTokFeed({ posts, siteData, heading }: TikTokFeedProps) {
  const scriptLoaded = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load the TikTok embed.js script once
  useEffect(() => {
    if (scriptLoaded.current) return;
    if (!posts.some((p) => p.oembed?.html)) return;

    scriptLoaded.current = true;
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [posts]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % posts.length);
  }, [posts.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + posts.length) % posts.length);
  }, [posts.length]);

  if (posts.length === 0) return null;

  const surface = siteData?.surface || "#ffffff";
  const primary = siteData?.primary || "#000000";
  const post = posts[activeIndex];

  return (
    <section className="py-12 md:py-16" style={{ background: surface }}>
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="flex items-center gap-3 mb-8">
          <TikTokIcon />
          <h2 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">
            {heading}
          </h2>
        </div>

        <div className="flex items-center justify-center gap-4">
          {/* Prev button */}
          {posts.length > 1 && (
            <button
              type="button"
              onClick={goPrev}
              className="flex-shrink-0 h-10 w-10 rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Previous video"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Video container — centered, max width for phone-style aspect ratio */}
          <div className="w-full max-w-sm">
            {post.oembed?.html ? (
              <TikTokEmbed key={activeIndex} html={post.oembed.html} />
            ) : (
              <TikTokCard post={post} primary={primary} />
            )}
          </div>

          {/* Next button */}
          {posts.length > 1 && (
            <button
              type="button"
              onClick={goNext}
              className="flex-shrink-0 h-10 w-10 rounded-full border border-black/10 bg-white shadow-sm flex items-center justify-center transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Next video"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Dots indicator */}
        {posts.length > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            {posts.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className="h-2 rounded-full transition-all cursor-pointer"
                style={{
                  width: idx === activeIndex ? 24 : 8,
                  backgroundColor: idx === activeIndex ? primary : "rgba(0,0,0,0.15)",
                }}
                aria-label={`Go to video ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Renders the TikTok oEmbed HTML (blockquote + triggers embed.js).
 */
function TikTokEmbed({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Strip the <script> tag from HTML — we load embed.js once globally
    const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    containerRef.current.innerHTML = cleanHtml;

    // Re-trigger embed.js to process new blockquotes
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = window as any;
      if (win.tiktokEmbed?.lib?.render) {
        win.tiktokEmbed.lib.render();
      }
    } catch {
      // embed.js not ready yet — it will pick up blockquotes on load
    }
  }, [html]);

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden [&_blockquote]:!max-w-none [&_iframe]:!max-w-none [&_blockquote]:!m-0 [&_iframe]:rounded-2xl"
    />
  );
}

/**
 * Fallback card when oEmbed is unavailable.
 */
function TikTokCard({ post, primary }: { post: TikTokEmbedData; primary: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm flex flex-col justify-between min-h-[200px]">
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TikTokIcon size={16} />
          <span className="text-xs font-semibold text-black/50 uppercase tracking-wider">TikTok</span>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-4">
          {post.caption || "TikTok video"}
        </p>
      </div>

      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ color: primary }}
        >
          Watch on TikTok
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      )}
    </div>
  );
}

function TikTokIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72a8.2 8.2 0 0 0 4.76 1.52V6.69h-1z"
        fill="currentColor"
      />
    </svg>
  );
}
