'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShowsPage } from '@vivreal/site-renderer';
import type { ShowData, SiteData } from '@vivreal/site-renderer';

const PAGE_SIZE = 20;

interface ShowsPageWrapperProps {
  upcomingShows: ShowData[];
  initialPastShows: ShowData[];
  labels: { title: string; subtitle: string; upcoming: string; past: string };
  slug: string;
  siteData: SiteData;
  collectionId: string;
  totalCount: number;
}

export default function ShowsPageWrapper({
  upcomingShows,
  initialPastShows,
  labels,
  slug,
  siteData,
  collectionId,
  totalCount,
}: ShowsPageWrapperProps) {
  const [pastShows, setPastShows] = useState(initialPastShows);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadedAll = useRef(upcomingShows.length + initialPastShows.length >= totalCount);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || loadedAll.current) return;
    setLoadingMore(true);
    try {
      const skip = upcomingShows.length + pastShows.length;
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        skip: String(skip),
        ...(collectionId ? { collectionId } : {}),
      });
      const res = await fetch(`/api/shows?${params}`);
      const json = await res.json();
      if (json.success && json.data?.shows?.length) {
        const today = new Date();
        const newPast = (json.data.shows as ShowData[]).filter(
          (s) => s.date && new Date(s.date) < today
        );
        setPastShows((prev) => [...prev, ...newPast]);
        if (skip + json.data.shows.length >= json.data.totalCount || json.data.shows.length < PAGE_SIZE) {
          loadedAll.current = true;
        }
      } else {
        loadedAll.current = true;
      }
    } catch (err) {
      console.error('Failed to load more shows:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, upcomingShows.length, pastShows.length, collectionId]);

  return (
    <ShowsPage
      upcomingShows={upcomingShows}
      pastShows={pastShows}
      labels={labels}
      slug={slug}
      siteData={siteData}
      onLoadMore={handleLoadMore}
      hasMore={!loadedAll.current}
      loadingMore={loadingMore}
      LinkComponent={Link}
      ImageComponent={Image}
    />
  );
}
