'use client';
import type { ElementType } from 'react';
import type { NavItem } from '../types/SiteData';

export interface NavbarViewProps {
  siteName: string;
  logoUrl?: string;
  navItems: NavItem[];
  accentColor?: string;
  LinkComponent?: ElementType;
  ImageComponent?: ElementType;
}

export default function NavbarView({
  siteName,
  logoUrl,
  navItems,
  accentColor,
  LinkComponent = 'a',
  ImageComponent = 'img',
}: NavbarViewProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        className="content-grid"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
          paddingTop: '0',
          paddingBottom: '0',
        }}
      >
        {/* Brand — logo + site name */}
        <LinkComponent
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          {logoUrl && (
            <ImageComponent
              src={logoUrl}
              alt={`${siteName} logo`}
              width={32}
              height={32}
              style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
            />
          )}
          <span
            style={{
              fontWeight: 700,
              fontSize: '1.125rem',
              color: accentColor ?? 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {siteName}
          </span>
        </LinkComponent>

        {/* Desktop nav links */}
        {navItems.length > 0 && (
          <nav
            style={{
              display: 'none',
              alignItems: 'center',
              gap: '8px',
            }}
            className="navbar-desktop-nav"
          >
            {navItems.map((item) => (
              <LinkComponent
                key={item.path}
                href={item.path}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.9375rem',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.backgroundColor = accentColor
                    ? `${accentColor}18`
                    : 'color-mix(in srgb, var(--secondary) 10%, transparent)';
                  e.currentTarget.style.color = accentColor ?? 'var(--text-primary)';
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
              >
                {item.name}
              </LinkComponent>
            ))}
          </nav>
        )}
      </div>

      {/* Inline style to show desktop nav at md+ breakpoint */}
      <style>{`
        @media (min-width: 768px) {
          .navbar-desktop-nav {
            display: flex !important;
          }
        }
      `}</style>
    </header>
  );
}
