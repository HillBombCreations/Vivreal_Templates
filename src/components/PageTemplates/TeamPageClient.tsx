'use client';

import Link from 'next/link';
import Image from 'next/image';
import { TeamPage } from '@hillbombcreations/site-renderer';
import type { TeamPageProps } from '@hillbombcreations/site-renderer';

type Props = Omit<TeamPageProps, 'LinkComponent' | 'ImageComponent'>;

export default function TeamPageClient(props: Props) {
  return (
    <TeamPage
      {...props}
      LinkComponent={Link}
      ImageComponent={Image}
    />
  );
}
