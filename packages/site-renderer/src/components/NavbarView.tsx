'use client';
import { useState } from 'react';
import { Menu, X, ShoppingCart } from 'lucide-react';
import type { NavItem, PageConfig } from '../types/SiteData';
import { useSiteRenderer } from '../context/SiteRendererContext';

export interface NavbarViewProps {
  siteName: string;
  logoUrl?: string;
  navItems: NavItem[];
  accentColor?: string;
  pageConfigs?: PageConfig[];
}

export default function NavbarView({
  siteName,
  logoUrl,
  navItems,
  accentColor,
  pageConfigs,
}: NavbarViewProps) {
  const { LinkComponent, ImageComponent } = useSiteRenderer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const primary = accentColor ?? '#1a1a2e';

  // Find the review/form page for the CTA button
  const reviewPage = pageConfigs?.find((p) => p.format === 'form');

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-4 pb-1 md:pt-5 bg-white/90 backdrop-blur-sm">
        <div className="w-full px-4">
          {/* Mobile nav */}
          <div className="flex md:hidden items-center justify-between">
            <LinkComponent href="/" onClick={(e: React.MouseEvent) => e.preventDefault()} className="flex-1 inline-flex items-center gap-2">
              {logoUrl && (
                <ImageComponent
                  src={logoUrl}
                  alt={siteName || 'Logo'}
                  width={48}
                  height={48}
                  className="inline-block object-contain"
                  style={{ width: 48, height: 48, objectFit: 'contain' }}
                />
              )}
              <span className="text-2xl font-semibold leading-none" style={{ color: 'var(--text-primary, #0b1220)' }}>
                {siteName}
              </span>
            </LinkComponent>
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg hover:bg-black/5 transition" aria-label="Cart">
                <ShoppingCart className="h-5 w-5" style={{ color: 'var(--text-primary, #333)' }} />
              </button>
              <button
                className="p-2 rounded-lg hover:bg-black/5 transition"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Menu"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
          <hr className="md:hidden mt-1 border-black/10" />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center relative justify-between">
            {/* Left: Logo + Name */}
            <div className="flex items-center gap-2.5">
              <LinkComponent href="/" onClick={(e: React.MouseEvent) => e.preventDefault()} className="flex items-center gap-2.5">
                {logoUrl && (
                  <ImageComponent
                    src={logoUrl}
                    alt={siteName || 'Logo'}
                    width={40}
                    height={40}
                    className="object-contain"
                    style={{ width: 40, height: 40, objectFit: 'contain' }}
                  />
                )}
                <span className="text-xl font-semibold text-gray-900">
                  {siteName}
                </span>
              </LinkComponent>
            </div>

            {/* Center: Nav links */}
            <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-1">
              {navItems.map((item) => (
                <LinkComponent
                  key={item.path}
                  href={item.path}
                  onClick={(e: React.MouseEvent) => e.preventDefault()}
                  className="nav-link text-base font-medium px-3 py-2 text-gray-800 relative transition-colors hover:text-gray-900"
                >
                  {item.label || item.name}
                </LinkComponent>
              ))}
            </nav>

            {/* Right: Cart + CTA */}
            <div className="flex items-center gap-3">
              <button className="p-2 rounded-lg hover:bg-black/5 transition relative" aria-label="Cart">
                <ShoppingCart className="h-5 w-5" style={{ color: 'var(--text-primary, #333)' }} />
              </button>
              {reviewPage && (
                <LinkComponent
                  href={`/${reviewPage.slug}`}
                  onClick={(e: React.MouseEvent) => e.preventDefault()}
                  className="inline-flex items-center h-9 px-4 rounded-lg text-sm font-medium border transition hover:opacity-90"
                  style={{ borderColor: primary, color: primary }}
                >
                  {reviewPage.labels?.navLabel || 'Leave A Review'}
                </LinkComponent>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-white pt-20 px-6">
          <button
            className="absolute top-5 right-5 p-2 rounded-lg hover:bg-black/5"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
          <nav className="flex flex-col gap-2">
            {navItems.map((item) => (
              <LinkComponent
                key={item.path}
                href={item.path}
                className="text-lg font-medium py-3 px-4 rounded-xl hover:bg-black/5 transition"
                style={{ color: 'var(--text-primary, #0b1220)' }}
                onClick={(e: React.MouseEvent) => { e.preventDefault(); setMobileOpen(false); }}
              >
                {item.label || item.name}
              </LinkComponent>
            ))}
          </nav>
        </div>
      )}

      {/* Nav link hover underline effect */}
      <style>{`
        .nav-link {
          position: relative;
        }
        .nav-link::after {
          content: "";
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0%;
          height: 2px;
          background-color: ${primary};
          transition: width 0.3s ease;
        }
        .nav-link:hover::after {
          width: 100%;
        }
        .nav-link:hover {
          color: ${primary} !important;
        }
      `}</style>

      {/* Spacer for fixed header */}
      <div style={{ height: '72px' }} />
    </>
  );
}
