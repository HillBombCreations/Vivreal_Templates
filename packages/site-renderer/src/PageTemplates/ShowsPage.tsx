'use client';

import { Calendar, MapPin, Loader2 } from 'lucide-react';
import type { SiteData } from '../types/SiteData';
import type { ShowData } from '../types/Showcase';
import { useSiteRenderer } from '../context/SiteRendererContext';

export interface ShowsPageProps {
  upcomingShows: ShowData[];
  pastShows: ShowData[];
  labels: { title: string; subtitle: string; upcoming: string; past: string };
  slug: string;
  siteData: SiteData;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export default function ShowsPage({
  upcomingShows,
  pastShows,
  labels,
  slug,
  siteData,
  onLoadMore,
  hasMore,
  loadingMore,
}: ShowsPageProps) {
  const { LinkComponent, ImageComponent, previewMode } = useSiteRenderer();
  const Img = ImageComponent ?? 'img';
  const A = previewMode ? 'span' : (LinkComponent ?? 'a');
  const primary = siteData?.primary ?? '#1a1a2e';

  return (
    <main className="pt-24 md:pt-32 pb-20 md:pb-32">
      {/* Header */}
      <section className="mx-auto max-w-6xl px-6 text-center space-y-6 mb-16">
        <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
          {labels.title}
        </h1>
        <p className="text-gray-700 text-lg md:text-xl max-w-3xl mx-auto">
          {labels.subtitle}
        </p>
      </section>

      {/* Upcoming shows */}
      <section className="mx-auto max-w-7xl px-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">
          {labels.upcoming}
        </h2>
        {upcomingShows?.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 transition-opacity duration-500 animate-fade-in">
            {upcomingShows.map((item, idx) => (
              <A
                key={`upcoming_${idx}`}
                href={`/${slug}/${item.id}`}
                className="block h-full group focus:outline-none"
              >
                {/* Card */}
                <div className="h-full rounded-xl shadow-md overflow-hidden flex flex-col transition-all duration-300 transform group-hover:-translate-y-1 group-hover:shadow-lg">
                  <div className="relative w-full overflow-hidden bg-gray-100">
                    <Img
                      src={item.imageUrl || item.image || '/logo.png'}
                      alt={item.title || 'Content image'}
                      width={600}
                      height={500}
                      className="w-full h-72 object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  {/* CardHeader */}
                  <div className="p-4 pb-0">
                    {/* CardTitle */}
                    <h2 className="text-xl font-semibold line-clamp-2">{item.title}</h2>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-500 mt-1">
                      {item.date && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={13} />
                          {new Intl.DateTimeFormat('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }).format(new Date(item.date))}
                          {item.time ? ` at ${item.time}` : ''}
                        </span>
                      )}
                      {item.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={13} />
                          {item.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CardContent */}
                  <div className="p-4 pt-2 flex-1">
                    {/* CMS rich-text — sanitized server-side by VR_CMS_API before storage */}
                    <div
                      className="text-sm text-gray-600 line-clamp-3"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  </div>
                </div>
              </A>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">
            Nothing upcoming at the moment. Check back soon!
          </p>
        )}
      </section>

      {/* Past shows */}
      <section className="mx-auto max-w-7xl px-6 mt-16">
        <h2 className="text-2xl lg:text-3xl font-display font-bold mb-8 tracking-tight">
          {labels.past}
        </h2>
        {pastShows?.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
              {pastShows.map((show, idx) => (
                <A
                  key={`past_${idx}`}
                  href={`/${slug}/${show.id}`}
                  className="relative overflow-hidden rounded-xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 bg-gray-100 group"
                >
                  <Img
                    src={show.imageUrl || show.image || '/logo.png'}
                    alt={show.title || `Past content ${idx + 1}`}
                    width={400}
                    height={500}
                    className="w-full h-80 object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <h3 className="text-white text-sm font-semibold line-clamp-2">
                      {show.title}
                    </h3>
                    {show.date && (
                      <p className="text-white/80 text-xs mt-1">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(show.date))}
                      </p>
                    )}
                  </div>
                </A>
              ))}
            </div>

            {hasMore && onLoadMore && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="px-8 py-3 rounded-lg font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  style={{ background: primary, color: 'white' }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-gray-500">No past content yet.</p>
        )}
      </section>
    </main>
  );
}
