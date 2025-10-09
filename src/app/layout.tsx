import { ReactNode } from 'react';
import '@/styles/globals.css';
import { getSiteData } from '@/lib/api/siteData';
import Providers from '@/components/Providers';
import Script from 'next/script';

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const siteData = await getSiteData();

  return (
    <html lang="en">
        <body>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-PDC9TXR6Q2"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('consent', 'default', {
              ad_storage: 'denied',
              analytics_storage: 'denied'
            });
            gtag('config', 'G-PDC9TXR6Q2');
          `}
        </Script>
        <Script id="rb2b-tracking" strategy="afterInteractive">
          {`
            (function () {
              var reb2b = window.reb2b = window.reb2b || [];
              if (reb2b.invoked) return;
              reb2b.invoked = true;
              reb2b.methods = ["identify", "collect"];
              reb2b.factory = function (method) {
                return function () {
                  var args = Array.prototype.slice.call(arguments);
                  args.unshift(method);
                  reb2b.push(args);
                  return reb2b;
                };
              };
              for (var i = 0; i < reb2b.methods.length; i++) {
                var key = reb2b.methods[i];
                reb2b[key] = reb2b.factory(key);
              }
              reb2b.load = function (key) {
                var script = document.createElement("script");
                script.type = "text/javascript";
                script.async = true;
                script.src = "https://s3-us-west-2.amazonaws.com/b2bjsstore/b/" + key + "/Q6J2RHMP9E6D.js.gz";
                var first = document.getElementsByTagName("script")[0];
                first.parentNode.insertBefore(script, first);
              };
              reb2b.SNIPPET_VERSION = "1.0.1";
              reb2b.load("Q6J2RHMP9E6D");
            })();
          `}
        </Script>
        <Script id="rich-results" type="application/ld+json" strategy="afterInteractive">
          {`{
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": "https://www.vivreal.io/#webpage",
            "name": "Vivreal CMS | Affordable, Easy-to-Use Content Management",
            "description": "Vivreal is a flexible, cost-effective CMS that helps your team update your website quickly without developer support. Perfect for growing businesses.",
            "publisher": {
              "@type": "Organization",
              "name": "Vivreal",
              "url": "https://www.vivreal.io",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.vivreal.io/vrlogo.svg"
              }
            },
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": "https://www.vivreal.io"
            },
            "image": "https://www.vivreal.io/vivreallogo.svg",
            "url": "https://www.vivreal.io"
          }`}
        </Script>
            <Providers siteData={siteData}>
                {children}
            </Providers>
        </body>
    </html>
  );
}

export default RootLayout;