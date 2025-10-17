import Head from "next/head";
import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";

export const metadata = {
  title: "Terms of Service",
  description:
    "Review our terms of service for details on website usage, user responsibilities, and your rights when using this site.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service",
    description:
      "Review our terms of service for details on website usage, user responsibilities, and your rights when using this site.",
    url: "/terms",
    images: [
      {
        url: "/terms-meta.png",
        width: 1200,
        height: 630,
        alt: "Terms of Service",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service",
    description:
      "Review our terms of service for details on website usage, user responsibilities, and your rights when using this site.",
    images: ["/terms-meta.png"],
  },
};

const TermsOfService = () => {
  return (
    <>
      <Head>
        <title>Terms of Service | Template</title>
        <meta
          name="description"
          content="Review our terms of service for details on website usage, user responsibilities, and your rights when using this site."
        />
        <link rel="canonical" href={"/terms"} />
      </Head>

      <Navbar />

      <main className="pt-24 pb-20">
        <section className="pt-10 pb-16">
          <div className="content-grid space-y-8 max-w-4xl mx-auto">
            {/* Intro */}
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
              Terms of Service
            </h1>
            <p className="text-gray-700">
              Welcome to our website. By accessing or using this site, you agree
              to be bound by these Terms of Service. Please read them carefully.
              If you do not agree with these terms, please discontinue use of
              the site.
            </p>

            {/* Site Access */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Access & Use of the Site
              </h2>
              <p className="text-gray-700">
                You are granted a limited, non-transferable license to access and
                use this site for personal, non-commercial purposes. You agree
                not to misuse the site or attempt to interfere with its
                operation.
              </p>
            </div>

            {/* Restrictions */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Restrictions
              </h2>
              <p className="text-gray-700">
                You may not copy, distribute, modify, reverse engineer, or
                otherwise exploit any part of this site without prior written
                permission. Unauthorized use may result in termination of your
                access.
              </p>
            </div>

            {/* Third Parties */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Third-Party Links & Content
              </h2>
              <p className="text-gray-700">
                This site may contain links to third-party websites. We are not
                responsible for the content, policies, or practices of those
                websites, and you access them at your own risk.
              </p>
            </div>

            {/* Disclaimer & Liability */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Disclaimer & Limitation of Liability
              </h2>
              <p className="text-gray-700">
                This site is provided &quot;as is&quot; without warranties of
                any kind. We are not liable for any damages resulting from your
                use of this site. Some jurisdictions do not allow certain
                limitations, so these may not apply to you.
              </p>
            </div>

            {/* Governing Law */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Governing Law
              </h2>
              <p className="text-gray-700">
                These Terms shall be governed by and interpreted in accordance
                with the laws of your local jurisdiction. Any disputes will be
                handled in the appropriate courts of that jurisdiction.
              </p>
            </div>

            {/* Contact */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Contact Information
              </h2>
              <p className="text-gray-700">
                If you have any questions about these Terms, please contact us
                at: <a href="mailto:hello@thecomedycollective.com" className="underline">hello@thecomedycollective.com</a>
              </p>
            </div>
          </div>
        </section>

        <CTASection />
      </main>

      <Footer />
    </>
  );
};

export default TermsOfService;