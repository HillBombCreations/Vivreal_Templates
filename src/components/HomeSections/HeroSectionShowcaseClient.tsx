'use client';

import Link from 'next/link';
import Image from 'next/image';
import { HeroSectionShowcase } from '@hillbombcreations/site-renderer';
import type { HeroSectionShowcaseProps } from '@hillbombcreations/site-renderer';

type Props = Omit<HeroSectionShowcaseProps, 'LinkComponent' | 'ImageComponent'>;

export default function HeroSectionShowcaseClient(props: Props) {
  return (
    <HeroSectionShowcase
      {...props}
      LinkComponent={Link}
      ImageComponent={Image}
    />
  );
}
