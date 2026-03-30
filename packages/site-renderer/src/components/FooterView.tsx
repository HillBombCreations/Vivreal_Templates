'use client';
import type { ElementType } from 'react';
import type { NavItem, SocialLink } from '../types/SiteData';

export interface FooterViewProps {
  siteName: string;
  logoUrl?: string;
  email?: string;
  navItems: NavItem[];
  socialLinks?: SocialLink[];
  accentColor?: string;
  LinkComponent?: ElementType;
  ImageComponent?: ElementType;
}

const SOCIAL_PLATFORM_URLS: Record<string, string> = {
  twitter: 'https://twitter.com/',
  x: 'https://x.com/',
  instagram: 'https://instagram.com/',
  facebook: 'https://facebook.com/',
  linkedin: 'https://linkedin.com/in/',
  tiktok: 'https://tiktok.com/@',
  youtube: 'https://youtube.com/',
  pinterest: 'https://pinterest.com/',
};

function resolveUrl(link: SocialLink): string {
  if (link.url.startsWith('http')) return link.url;
  const base = SOCIAL_PLATFORM_URLS[link.platform.toLowerCase()];
  return base ? `${base}${link.url}` : `https://${link.url}`;
}

export default function FooterView({
  siteName,
  logoUrl,
  email,
  navItems,
  socialLinks = [],
  accentColor,
  LinkComponent = 'a',
  ImageComponent = 'img',
}: FooterViewProps) {
  return (
    <footer
      style={{
        background:
          'color-mix(in srgb, var(--secondary) 15%, var(--surface))',
        borderTop: '1px solid var(--border)',
        paddingTop: '48px',
        paddingBottom: '0',
      }}
    >
      {/* 3-column grid */}
      <div className="content-grid">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(1, 1fr)',
            gap: '40px',
            paddingBottom: '40px',
          }}
          className="footer-grid"
        >
          {/* Column 1: Brand */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <LinkComponent
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                textDecoration: 'none',
                width: 'fit-content',
              }}
            >
              {logoUrl && (
                <ImageComponent
                  src={logoUrl}
                  alt={`${siteName} logo`}
                  width={28}
                  height={28}
                  style={{
                    width: '28px',
                    height: '28px',
                    objectFit: 'contain',
                    borderRadius: '4px',
                  }}
                />
              )}
              <span
                style={{
                  fontWeight: 700,
                  fontSize: '1.0625rem',
                  color: accentColor ?? 'var(--text-primary)',
                }}
              >
                {siteName}
              </span>
            </LinkComponent>
            {email && (
              <a
                href={`mailto:${email}`}
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                }}
              >
                {email}
              </a>
            )}
          </div>

          {/* Column 2: Pages */}
          {navItems.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                }}
              >
                Pages
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {navItems.map((item) => (
                  <li key={item.path}>
                    <LinkComponent
                      href={item.path}
                      style={{
                        fontSize: '0.9375rem',
                        color: 'var(--text-primary)',
                        textDecoration: 'none',
                        opacity: 0.85,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.opacity = '0.85';
                      }}
                    >
                      {item.name}
                    </LinkComponent>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Column 3: Social */}
          {socialLinks.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-secondary)',
                  marginBottom: '12px',
                }}
              >
                Follow Us
              </p>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {socialLinks.map((link) => (
                  <li key={link.platform}>
                    <a
                      href={resolveUrl(link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: '0.9375rem',
                        color: accentColor ?? 'var(--text-primary)',
                        textDecoration: 'none',
                        opacity: 0.85,
                        transition: 'opacity 0.15s',
                        textTransform: 'capitalize',
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.opacity = '0.85';
                      }}
                    >
                      {link.platform}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
        }}
      >
        <div
          className="content-grid"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            paddingBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            &copy; {new Date().getFullYear()} {siteName}
          </span>
          <a
            href="https://vivreal.io"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              opacity: 0.7,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
              e.currentTarget.style.opacity = '0.7';
            }}
          >
            Powered by Vivreal
          </a>
        </div>
      </div>

      {/* Responsive grid */}
      <style>{`
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
    </footer>
  );
}
