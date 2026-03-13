"use client";

import { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface GetStartedButtonProps {
    color: string;
}

const GetStartedButton = ({ color }: GetStartedButtonProps) => {
    const style: CSSProperties & { [key: string]: string } = {
        '--btn-bg': color,
        backgroundColor: 'var(--btn-bg)'
    };

    const adjustColorBrightness = (hex: string, percent: number) => {
        hex = hex.replace(/^#/, '');
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);
        r = Math.min(255, Math.max(0, r + (r * percent) / 100));
        g = Math.min(255, Math.max(0, g + (g * percent) / 100));
        b = Math.min(255, Math.max(0, b + (b * percent) / 100));
        const newHex =
            '#' +
            [r, g, b]
            .map(x => {
                const hex = Math.round(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            })
            .join('');

        return newHex;
    }

  return (
        <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-3xl text-white font-medium transition "
            style={style}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = adjustColorBrightness(color, 0.9);
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = color;
            }}
        >
        {'Learn More'}
        <ArrowRight className="w-4 h-4" />
        </Link>
  );
};

export default GetStartedButton;