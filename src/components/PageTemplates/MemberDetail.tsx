"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { TeamData } from "@/types/Team";
import type { SiteData } from "@/types/SiteData";

interface TikTokEmbedItem {
  caption: string;
  permalink: string;
  html: string | null;
}

interface MemberDetailProps {
  member: TeamData;
  siteData: SiteData;
  tiktokEmbeds: TikTokEmbedItem[];
  backSlug?: string;
}

export default function MemberDetail({ member, siteData, tiktokEmbeds, backSlug = "team" }: MemberDetailProps) {
  const primary = siteData?.primary || "#000000";
  const surface = siteData?.surface || "#ffffff";
  const panelBg = "#eef1f5";
  const hasSocial = tiktokEmbeds.length > 0;

  return (
    <main className="pt-24 md:pt-32 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        {/* Back link */}
        <Link
          href={`/${backSlug}`}
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-opacity hover:opacity-70"
          style={{ color: primary }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <div className={`flex flex-col ${hasSocial ? "lg:flex-row lg:items-start" : ""} gap-8`}>
          {/* Left — Member info */}
          <div
            className={`${hasSocial ? "lg:w-1/2" : "max-w-2xl"} rounded-2xl p-8 md:p-10`}
            style={{ backgroundColor: panelBg }}
          >
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-8">
              <div
                className="w-48 h-48 rounded-full overflow-hidden flex-shrink-0 ring-4"
                style={{ ["--tw-ring-color" as string]: `${primary}20` }}
              >
                <Image
                  src={member.imageUrl || member.image || "/logo.png"}
                  alt={member.name}
                  width={300}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-3xl md:text-4xl font-bold mb-3">{member.name}</h1>
                <SocialBadges socialLinks={member.socialLinks} primary={primary} surface={surface} />
              </div>
            </div>

            <article className="prose prose-lg max-w-none">
              <div dangerouslySetInnerHTML={{ __html: member.description }} />
            </article>
          </div>

          {/* Right — Social content carousel */}
          {hasSocial && (
            <div className="lg:w-1/2">
              <TikTokCarousel embeds={tiktokEmbeds} primary={primary} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function TikTokCarousel({ embeds, primary }: { embeds: TikTokEmbedItem[]; primary: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i + 1) % embeds.length);
  }, [embeds.length]);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i - 1 + embeds.length) % embeds.length);
  }, [embeds.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TikTokIcon />
          <h2 className="text-xl font-bold">TikTok</h2>
        </div>
        {embeds.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrev}
              className="h-8 w-8 rounded-full border border-black/10 bg-white flex items-center justify-center transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Previous video"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-500 tabular-nums min-w-[3ch] text-center">
              {activeIndex + 1}/{embeds.length}
            </span>
            <button
              type="button"
              onClick={goNext}
              className="h-8 w-8 rounded-full border border-black/10 bg-white flex items-center justify-center transition-colors hover:bg-gray-50 cursor-pointer"
              aria-label="Next video"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Render all embeds, show/hide via CSS so they all load in parallel */}
      {embeds.map((e, idx) => (
        <div
          key={idx}
          className="rounded-2xl overflow-hidden"
          style={{ display: idx === activeIndex ? "block" : "none" }}
        >
          {e.html ? (
            <TikTokEmbed html={e.html} />
          ) : (
            <TikTokCard embed={e} primary={primary} />
          )}
        </div>
      ))}

      {/* Dots */}
      {embeds.length > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {embeds.map((_, idx) => (
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
  );
}

function SocialBadges({ socialLinks, primary, surface }: { socialLinks?: TeamData["socialLinks"]; primary: string; surface: string }) {
  if (!socialLinks) return null;
  const links = Object.entries(socialLinks).filter(([, v]) => v);
  if (links.length === 0) return null;

  const icons: Record<string, { icon: React.ReactNode; baseUrl: string }> = {
    tiktok: {
      icon: <TikTokIcon size={14} />,
      baseUrl: "https://www.tiktok.com/",
    },
    instagram: {
      icon: <InstagramIcon size={14} />,
      baseUrl: "https://www.instagram.com/",
    },
    linkedin: {
      icon: <LinkedInIcon size={14} />,
      baseUrl: "https://www.linkedin.com/in/",
    },
    x: {
      icon: <XIcon size={14} />,
      baseUrl: "https://x.com/",
    },
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {links.map(([platform, handle]) => {
        const config = icons[platform];
        if (!config || !handle) return null;
        const cleanHandle = handle.replace(/^@/, "");
        return (
          <a
            key={platform}
            href={`${config.baseUrl}${cleanHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-black/10 hover:shadow-sm transition-shadow"
            style={{ color: primary, backgroundColor: surface }}
          >
            {config.icon}
            {handle}
          </a>
        );
      })}
    </div>
  );
}

const TARGET_HEIGHT = 600;

function TikTokEmbed({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [naturalHeight, setNaturalHeight] = useState(TARGET_HEIGHT);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    const doc = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;overflow:hidden;display:flex;justify-content:center}
blockquote{max-width:none!important;margin:0!important;font-size:0;color:transparent}
blockquote *{font-size:0;color:transparent}
</style>
</head><body>${cleanHtml}<script src="https://www.tiktok.com/embed.js" async></script></body></html>`;

    iframe.srcdoc = doc;

    const interval = setInterval(() => {
      try {
        const body = iframe.contentDocument?.body;
        if (body && body.scrollHeight > 100) {
          setNaturalHeight(body.scrollHeight);
        }
      } catch {
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [html]);

  const scale = Math.min(1, TARGET_HEIGHT / naturalHeight);
  const displayHeight = naturalHeight * scale;

  return (
    <div style={{ height: displayHeight, overflow: "hidden" }}>
      <iframe
        ref={iframeRef}
        title="TikTok embed"
        className="w-full border-0"
        scrolling="no"
        style={{
          height: naturalHeight,
          overflow: "hidden",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${100 / scale}%`,
        }}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    </div>
  );
}

function TikTokCard({ embed, primary }: { embed: TikTokEmbedItem; primary: string }) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <TikTokIcon size={16} />
        <span className="text-xs font-semibold text-black/50 uppercase tracking-wider">TikTok</span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 mb-4">
        {embed.caption || "TikTok video"}
      </p>
      <a
        href={embed.permalink}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: primary }}
      >
        Watch on TikTok
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </a>
    </div>
  );
}

function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.72a8.2 8.2 0 0 0 4.76 1.52V6.69h-1z"
        fill="currentColor"
      />
    </svg>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function LinkedInIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
