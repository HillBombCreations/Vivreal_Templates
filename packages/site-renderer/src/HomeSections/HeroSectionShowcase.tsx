'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Calendar, MapPin, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ShowData, PartnerData } from '../types/Showcase';
import type { SiteData } from '../types/SiteData';
import { useSiteRenderer } from '../context/SiteRendererContext';

const SCROLL_SPEED = 0.3; // pixels per frame

/* ------------------------------------------------------------------ */
/*  Skeleton loaders (inlined from Vivreal_Templates)                 */
/* ------------------------------------------------------------------ */

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/40 ${className}`}
    aria-hidden="true"
  />
);

const ShowSkeletonCard = ({ isMobile }: { isMobile: boolean }) => (
  <div
    className={`flex ${isMobile ? 'flex-col' : 'flex-row'} rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden`}
    role="status"
    aria-live="polite"
  >
    <div className={`${isMobile ? 'w-full h-48 rounded-t-lg' : 'w-40 h-auto rounded-l-lg'} overflow-hidden`}>
      <Skeleton className={`${isMobile ? 'h-48 w-full' : 'h-full min-h-[160px] w-40'}`} />
    </div>
    <div className={`${isMobile ? 'p-4' : 'flex-1 p-4'}`}>
      <Skeleton className="h-6 w-2/3 mb-3" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <Skeleton className={`${isMobile ? 'w-full max-w-xs' : 'w-28'} h-9 rounded`} />
    </div>
  </div>
);

const PastShowSkeleton = () => (
  <div className="relative flex-shrink-0 w-48 overflow-hidden rounded-xl shadow-sm">
    <Skeleton className="w-full h-64" />
  </div>
);

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface HeroSectionShowcaseProps {
  siteData: SiteData;
  // Flat props (primary API)
  shows?: ShowData[];
  partners?: PartnerData[];
  labels?: { upcoming?: string; past?: string };
  showsSlug?: string;
  // HomeSectionRenderer compat
  config?: Record<string, unknown>;
  prefetchedData?: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

const HeroSectionShowcase = (props: HeroSectionShowcaseProps) => {
  const { siteData } = props;
  const { LinkComponent, ImageComponent, previewMode = false } = useSiteRenderer();

  // Resolve props — flat props take priority over prefetchedData
  const resolvedShows = props.shows ?? (props.prefetchedData?.shows as ShowData[]) ?? [];
  const resolvedPartners = props.partners ?? (props.prefetchedData?.partners as PartnerData[]) ?? [];
  const resolvedLabels = props.labels ?? (props.prefetchedData?.labels as { upcoming: string; past: string }) ?? { upcoming: 'Upcoming', past: 'Past' };
  const resolvedShowsSlug = props.showsSlug ?? (props.prefetchedData?.showsSlug as string) ?? 'shows';

  const Img = ImageComponent ?? 'img';
  const A = previewMode ? 'span' : (LinkComponent ?? 'a');

  const [isMobile, setIsMobile] = useState(false);
  const [upcomingShows, setUpcomingShows] = useState<ShowData[]>([]);
  const [pastShows, setPastShows] = useState<ShowData[]>([]);
  const [loading, setLoading] = useState(true);

  const primary = siteData?.primary || '#000000';
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  const upcomingLabel = resolvedLabels.upcoming ?? 'Upcoming';
  const pastLabel = resolvedLabels.past ?? 'Past';

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setLoading(true);

    if (resolvedShows.length === 0) {
      setUpcomingShows([]);
      setPastShows([]);
      setLoading(false);
      return;
    }

    const today = new Date();

    // Items with valid dates: split by date >= today
    // Items WITHOUT dates: go to upcoming (shown, not filtered out)
    const upcoming = resolvedShows
      .filter((show) => !show.date || new Date(show.date) >= today)
      .sort((a, b) => new Date(a.date ?? 0).getTime() - new Date(b.date ?? 0).getTime());

    const past = resolvedShows
      .filter((show) => show.date && new Date(show.date) < today)
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    setUpcomingShows(upcoming);
    setPastShows(past);
    setLoading(false);
  }, [resolvedShows]);

  return (
    <section
      style={{ background: siteData?.surface }}
      className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Hero banner */}
      <div className="mx-5 md:mx-20 lg:mx-40">
        <div className="grid items-center gap-12 sm:grid-cols-2">
          <div>
            <h1
              id="hero-heading"
              className="text-4xl lg:text-5xl font-display font-bold tracking-tight"
            >
              <small style={{ color: primary }}>Welcome to</small>
              <br />
              <span style={{ color: primary }}>{siteName}</span>
            </h1>
            <hr className="my-6 border-gray-300" />
            <p className="text-gray-700 text-lg md:text-xl">
              {siteData?.businessInfo?.description || 'Discover our latest content, upcoming events, and more.'}
            </p>

            {/* Featured venues / partners */}
            {resolvedPartners.length > 0 && (
              <div className="mt-8">
                <p className="text-sm font-medium text-gray-900 mb-4">
                  {siteData?.partnerTagline || 'Featuring top talent from these iconic stages and more!'}
                </p>
                <div className="flex flex-wrap items-center gap-6 md:gap-8">
                  {resolvedPartners.map((partner, idx) => (
                    <Img
                      key={idx}
                      src={partner.logoUrl || '/logo.png'}
                      alt={partner.name}
                      width={120}
                      height={60}
                      className="max-h-16 md:max-h-20 max-w-[140px] md:max-w-[160px] w-auto h-auto object-contain grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-center">
            <Img
              src={siteData?.heroImage?.currentFile?.source || '/heroImage.png'}
              alt={siteName}
              width={600}
              height={400}
              className="w-full h-auto object-contain"
            />
          </div>
        </div>

        {/* Upcoming content */}
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-24 md:mt-32 tracking-tight">
          {upcomingLabel}
        </h2>

        {loading ? (
          <div className="flex flex-col gap-4 mt-6" aria-busy="true">
            {[...Array(3)].map((_, i) => (
              <ShowSkeletonCard key={i} isMobile={isMobile} />
            ))}
          </div>
        ) : upcomingShows.length === 0 ? (
          <p className="mt-6 text-gray-500">Nothing upcoming at the moment. Check back soon!</p>
        ) : (
          <div className="flex flex-col gap-4 mt-6">
            {upcomingShows.map((show, idx) => (
              <UpcomingShowCard
                key={idx}
                show={show}
                isMobile={isMobile}
                primary={primary}
                showsSlug={resolvedShowsSlug}
              />
            ))}
          </div>
        )}

        {/* Past content -- auto-scrolling carousel */}
        <h2 className="text-2xl lg:text-3xl font-display font-bold mt-24 md:mt-32 tracking-tight">
          {pastLabel}
        </h2>

        {loading ? (
          <div className="flex gap-4 mt-6 overflow-hidden" aria-busy="true">
            {[...Array(5)].map((_, i) => (
              <PastShowSkeleton key={i} />
            ))}
          </div>
        ) : pastShows.length === 0 ? (
          <p className="mt-6 text-gray-500">No past content yet.</p>
        ) : (
          <PastShowsCarousel
            shows={pastShows}
            primary={primary}
            surface={siteData?.surface || '#ffffff'}
            showsSlug={resolvedShowsSlug}
          />
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  UpcomingShowCard                                                   */
/* ------------------------------------------------------------------ */

function UpcomingShowCard({
  show,
  isMobile,
  primary,
  showsSlug,
}: {
  show: ShowData;
  isMobile: boolean;
  primary: string;
  showsSlug: string;
}) {
  const { LinkComponent, ImageComponent, previewMode = false } = useSiteRenderer();
  const Img = ImageComponent ?? 'img';
  const A = previewMode ? 'span' : (LinkComponent ?? 'a');
  return (
    <A
      href={`/${showsSlug}/${show.id}`}
      className={`
        flex ${isMobile ? 'flex-col' : 'flex-row'}
        rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden
        transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5
      `}
    >
      <div
        className={`
          ${isMobile ? 'w-full h-48 rounded-t-xl' : 'flex-shrink-0 w-44 h-auto rounded-l-xl'}
          overflow-hidden bg-gray-100
        `}
      >
        <Img
          src={show.imageUrl || show.image || '/logo.png'}
          alt={show.title || 'Content image'}
          width={0}
          height={0}
          sizes={isMobile ? '100vw' : '350px'}
          className="w-full h-full object-contain"
        />
      </div>
      <div className={`${isMobile ? 'p-5 rounded-b-xl flex flex-col items-center text-center' : 'flex-1 p-5 flex flex-col justify-between'}`}>
        <div>
          <h3 className="text-xl font-semibold text-gray-900">{show.title}</h3>
          <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
            {show.date && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} />
                {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(show.date))}
                {show.time ? ` at ${show.time}` : ''}
              </span>
            )}
            {show.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} />
                {show.location}
              </span>
            )}
          </div>
          {/* CMS rich-text description — sanitized server-side before storage */}
          <ShowDescription html={show.description} />
        </div>
        {show.ticketsUrl ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!previewMode) {
                window.open(show.ticketsUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            className={`
              mt-4 inline-flex items-center gap-2 px-5 py-2.5 cursor-pointer text-white text-sm font-semibold rounded-lg transition-colors
              ${isMobile ? 'w-full max-w-xs justify-center' : 'w-max self-start'}
            `}
            style={{ backgroundColor: primary }}
            aria-label="Open tickets in a new tab"
          >
            Get Tickets <ArrowRight size={14} />
          </button>
        ) : (
          <span
            className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${isMobile ? '' : 'self-start'}`}
            style={{ color: primary }}
          >
            View Details <ArrowRight size={14} />
          </span>
        )}
      </div>
    </A>
  );
}

/* ------------------------------------------------------------------ */
/*  ShowDescription                                                    */
/* ------------------------------------------------------------------ */

/**
 * Renders CMS rich-text description HTML.
 * Content is sanitized server-side by the CMS before storage.
 */
function ShowDescription({ html }: { html: string }) {
  return (
    <article className="prose prose-p:min-h-[.4em]">
      <div
        className="text-gray-600 text-sm mt-2 line-clamp-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  PastShowsCarousel                                                  */
/* ------------------------------------------------------------------ */

/**
 * Horizontally auto-scrolling carousel for past shows.
 * Pauses on hover, supports manual prev/next navigation.
 */
function PastShowsCarousel({
  shows,
  primary,
  surface,
  showsSlug = 'shows',
}: {
  shows: ShowData[];
  primary: string;
  surface: string;
  showsSlug?: string;
}) {
  const { LinkComponent, ImageComponent } = useSiteRenderer();
  const Img = ImageComponent ?? 'img';
  const A = LinkComponent ?? 'a';
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  // Auto-scroll animation loop
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let cancelled = false;
    let accum = 0; // accumulate sub-pixel increments

    const tick = () => {
      if (cancelled) return;
      if (!pausedRef.current && el.scrollWidth > el.clientWidth) {
        accum += SCROLL_SPEED;
        if (accum >= 1) {
          const px = Math.floor(accum);
          accum -= px;
          el.scrollLeft += px;
          if (el.scrollLeft >= el.scrollWidth - el.clientWidth) {
            el.scrollLeft = 0;
          }
          updateScrollButtons();
        }
      }
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
    updateScrollButtons();

    return () => { cancelled = true; };
  }, [shows, updateScrollButtons]);

  const scrollBy = (dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 300; // w-72 = 288px + gap
    el.scrollBy({ left: dir * cardWidth * 2, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 350);
  };

  return (
    <div
      className="relative group mt-6"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Left arrow */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll left"
        >
          <ChevronLeft size={20} style={{ color: primary }} />
        </button>
      )}

      {/* Right arrow */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Scroll right"
        >
          <ChevronRight size={20} style={{ color: primary }} />
        </button>
      )}

      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-[5] pointer-events-none" style={{ background: `linear-gradient(to right, ${surface}, transparent)` }} />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-[5] pointer-events-none" style={{ background: `linear-gradient(to left, ${surface}, transparent)` }} />

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        onScroll={updateScrollButtons}
      >
        {shows.map((show, idx) => (
          <A
            key={idx}
            href={`/${showsSlug}/${show.id}`}
            className="relative flex-shrink-0 w-72 overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100"
          >
            <Img
              src={show.imageUrl || show.image || '/logo.png'}
              alt={show.title || `Past content ${idx + 1}`}
              width={0}
              height={0}
              sizes="300px"
              className="w-full h-96 object-contain"
              loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <p className="text-white text-sm font-medium truncate">{show.title}</p>
              {show.date && (
                <p className="text-white/70 text-xs">
                  {new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(show.date))}
                </p>
              )}
            </div>
          </A>
        ))}
      </div>
    </div>
  );
}

export default HeroSectionShowcase;
