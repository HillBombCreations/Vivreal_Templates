/* eslint-disable @typescript-eslint/no-explicit-any */
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Helmet } from "react-helmet";
import Index from "./pages/Index";
import Pricing from "./pages/Pricing";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import NotFound from "./pages/NotFound";
import ArticlesPage from "./pages/Developers/articles.tsx";
import ArticlePost from "./pages/Developers/articlePost.tsx";
import CookieConsent from "@/components/CookieConsent";
import WhatWeDoPage from "./pages/Features/index.tsx";
import FAQPage from "./pages/Solutions/index.tsx";
import ContactPage from "./pages/Contact.tsx";
import { useCallback, useState, useEffect, ComponentType } from "react";
import { xmlToJSON } from './lib/utils.ts';
import axios from "axios";

const queryClient = new QueryClient();

type SitemapEntry = {
  loc: string;
  children?: SitemapEntry[];
  'custom:component'?: string;
  'custom:group'?: string;
  'custom:linklabel'?: string;
  'custom:path'?: string;
  'custom:iconcolor'?: string;
  'custom:iconstring'?: string;
  'custom:subtitle'?: string;
  component?: string;
  group?: string;
  linklabel?: string;
  path?: string;
  iconcolor?: string;
  iconstring?: string;
  subtitle?: string;
};

type SitemapJSON = Array<SitemapEntry>;

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }, [pathname]);

  return null;
}


const getSitemap = async () => {
	return await axios.get('/sitemap.xml', {
		headers: { 'Content-Type': 'text/xml; charset=utf-8' }
	});
};

function normalizeEntries(entries: Partial<SitemapEntry>[]): SitemapEntry[] {
  const normalized: SitemapEntry[] = [];

  entries.forEach((entry) => {
    if (entry['custom:component']) {
      entry.component = entry['custom:component'];
      delete entry['custom:component'];
    }
    if (entry['custom:group']) {
      entry.group = entry['custom:group'];
      delete entry['custom:group'];
    }
    if (entry['custom:linklabel']) {
      entry.linklabel = entry['custom:linklabel'];
      delete entry['custom:linklabel'];
    }
    if (entry['custom:path']) {
      entry.path = entry['custom:path'];
      delete entry['custom:path'];
    }
    if (entry['custom:iconcolor']) {
      entry.iconcolor = entry['custom:iconcolor'];
      delete entry['custom:iconcolor'];
    }
    if (entry['custom:iconstring']) {
      entry.iconstring = entry['custom:iconstring'];
      delete entry['custom:iconstring'];
    }
    if (entry['custom:subtitle']) {
      entry.subtitle = entry['custom:subtitle'];
      delete entry['custom:subtitle'];
    }

    const arrayKeys = Object.keys(entry).filter(key =>
      Array.isArray(entry[key as keyof SitemapEntry]) &&
      (entry[key as keyof SitemapEntry] as unknown[]).length > 1
    );

    if (arrayKeys.length === 0) {
      if (entry.path) {
        normalized.push(entry as SitemapEntry);
      }
    } else {
      const count = (entry[arrayKeys[0] as keyof SitemapEntry] as unknown[]).length;

      for (let i = 0; i < count; i++) {
        const newEntry = {} as SitemapEntry;

        (Object.keys(entry) as (keyof SitemapEntry)[]).forEach((key) => {
          const value = entry[key];

          if (Array.isArray(value)) {
            if (key === 'children') {
              newEntry[key] = [value[i] as SitemapEntry];
            } else {
              const val = value[i];
              if (typeof val === 'string') newEntry[key] = val;
              else newEntry[key] = String(val);
            }
          } else if (value !== undefined) {
            if (key === 'children') {
              if (Array.isArray(value)) newEntry[key] = value;
              else if (typeof value === 'object' && value !== null) newEntry[key] = [value as SitemapEntry];
            } else {
              newEntry[key] = typeof value === 'string' ? value : String(value);
            }
          }
        });

        if (newEntry.path) {
          normalized.push(newEntry);
        }
      }
    }
  });

  return normalized;
}


function nestSitemapEntries(entries: SitemapEntry[]): SitemapEntry[] {
  const map = new Map<string, SitemapEntry>();

  entries.forEach(e => map.set(e.path!, { ...e, children: [] }));

  const roots: SitemapEntry[] = [];

  entries.forEach(e => {
    if (!e.path) return;

    const pathSegments = e.path.split('/').filter(Boolean);
    if (pathSegments.length <= 1) {
      roots.push(map.get(e.path!)!);
    } else {
      const parentPath = '/' + pathSegments.slice(0, -1).join('/');
      const parentEntry = map.get(parentPath);
      if (parentEntry) {
        parentEntry.children = parentEntry.children || [];
        parentEntry.children.push(map.get(e.path!)!);
      } else {
        roots.push(map.get(e.path!)!);
      }
    }
  });
  
  return roots;
}

function buildRoutes(
  entries: SitemapEntry[], 
  componentDictionary: Record<string, ComponentType>
): JSX.Element[] {
  const formattedEntreis = entries.flatMap((entry, idx) => {
    const Component = entry.component ? componentDictionary[entry.component as keyof typeof componentDictionary] : null;
    const route = (Component && entry.path) ? (
      <Route key={`url_${entry.path}_${idx}`} path={entry.path} Component={Component} />
    ) : null;
    const childRoutes = entry.children ? buildRoutes(entry.children, componentDictionary) : [];

    return route ? [route, ...childRoutes] : childRoutes;
  });
  return formattedEntreis;
}

const injectClarity = () => {
  if ((window as any).clarity) return;
  const script = document.createElement("script");
  script.innerHTML = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/pgpex8klud?ref=bwt";
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "pgpex8klud");
  `;
  document.head.appendChild(script);
};

const App = () => {
  const handleAccept = useCallback(() => {
    injectClarity();
    window.gtag('consent', 'update', {
      analytics_storage: 'granted'
    });
  }, []);
  const [routes, setRoutes] = useState(null);
  const handleReject = useCallback(() => {
    // No-op for now
  }, []);

  useEffect(() => {
    getSitemap().then(({ data }) => {
			const componentDictionary = {
        landing: Index,
        privacyPolicy: Privacy,
        termsOfUse: Terms,
        pricingPage: Pricing,
        whatWeDoPage: WhatWeDoPage,
        faqPage: FAQPage,
        pricing: Pricing,
        articlesPage: ArticlesPage,
        contactPage: ContactPage
			};
			const urls = xmlToJSON(data) as SitemapJSON;
			const flatEntries = normalizeEntries(urls);
			const nestedEntries = nestSitemapEntries(flatEntries);
			const localRoutes = buildRoutes(nestedEntries, componentDictionary);
      localRoutes.push(<Route key="blog_dynamic" path="/developers/articles/:slug" Component={ArticlePost} />);
		  setRoutes(localRoutes);
		});
  }, []);

  return (
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<Helmet defaultTitle="Vivreal | Documentation" titleTemplate="%s" />
					<Toaster />
					<Sonner />
          <CookieConsent onAccept={handleAccept} onReject={handleReject} />
					<BrowserRouter>
            <ScrollToTop />
						{routes?.length ? (
							<Routes>
								{routes}
								<Route path="*" element={<NotFound />} />
							</Routes>
						) : (
							<Progress />
						)}
					</BrowserRouter>
				</TooltipProvider>
			</QueryClientProvider>
		);
};

export default App;
