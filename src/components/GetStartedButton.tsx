import { useEffect, useState, CSSProperties } from 'react';
import { ArrowRight } from 'lucide-react';

const GetStartedButton = ({ page, color, text = null, buttonSize = "px-6 py-3" }) => {
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

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 767px)");

        const handleChange = (e: MediaQueryListEvent) => {
        setIsMobile(e.matches);
        };

        setIsMobile(mediaQuery.matches);
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, []);

    const appliedButtonSize = buttonSize || "px-6 py-3";
    const colorClasses = {
        'blue-700': 'bg-blue-700 hover:bg-blue-700/90',
        'green-500': 'bg-green-500 hover:bg-green-500/90',
        'green-700': 'bg-green-700 hover:bg-green-700/90',
        'purple-700': 'bg-purple-700 hover:bg-purple-700/90',
        'red-700': 'bg-red-700 hover:bg-red-700/90',
        'primary': 'bg-primary hover:bg-primary/90'
    };
  return (
        <a
            href="https://app.vivreal.io/register/"
            className={`inline-flex items-center gap-2 ${appliedButtonSize} rounded-lg text-white font-medium transition`}
            style={style}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = adjustColorBrightness(color, 0.9);
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = color;
            }}
            onClick={() => {
                if (window.gtag) {
                window.gtag('event', 'get_started', {
                    device_type: isMobile ? 'Mobile' : 'Desktop',
                    page_name: page,
                    action: 'Get Started',
                    value: 1
                });
                }
            }}
        >
        {text || 'Create Your Free Account'}
        <ArrowRight className="w-4 h-4" />
        </a>
  );
};

export default GetStartedButton;