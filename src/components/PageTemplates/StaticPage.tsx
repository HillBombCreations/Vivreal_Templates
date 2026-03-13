import CTASection from "@/components/CTASection";

interface StaticPageProps {
  labels: { title: string; content: string };
  pageName: string;
}

/**
 * Generic static page template.
 * Renders title + HTML content from page labels.
 * Falls back to default privacy/terms content if no custom content provided.
 */
const DEFAULTS: Record<string, string> = {
  privacy: `
    <p>Your privacy is important to us. This Privacy Policy explains the types of information we collect, how it is used, and the choices you have regarding your data.</p>
    <h2>Information We Collect</h2>
    <p>We may collect personal details such as your name, email address, and messages submitted through our contact forms, as well as non-identifiable information like browser type and usage patterns.</p>
    <h2>Cookies &amp; Tracking</h2>
    <p>Our website may use cookies to improve your experience, analyze traffic, and remember preferences. You can choose to disable cookies in your browser settings if preferred.</p>
    <h2>Third-Party Services</h2>
    <p>We may use third-party tools for analytics or marketing purposes. These providers have their own privacy policies, and we recommend reviewing them to understand how they handle your information.</p>
    <h2>Children's Privacy</h2>
    <p>Our services are not directed at children under the age of 13, and we do not knowingly collect personal information from children.</p>
    <h2>Consent</h2>
    <p>By using this website, you consent to our Privacy Policy and agree to its terms.</p>
  `,
  terms: `
    <p>Welcome to our website. By accessing or using this site, you agree to be bound by these Terms of Service. Please read them carefully. If you do not agree with these terms, please discontinue use of the site.</p>
    <h2>Access &amp; Use of the Site</h2>
    <p>You are granted a limited, non-transferable license to access and use this site for personal, non-commercial purposes. You agree not to misuse the site or attempt to interfere with its operation.</p>
    <h2>Restrictions</h2>
    <p>You may not copy, distribute, modify, reverse engineer, or otherwise exploit any part of this site without prior written permission. Unauthorized use may result in termination of your access.</p>
    <h2>Third-Party Links &amp; Content</h2>
    <p>This site may contain links to third-party websites. We are not responsible for the content, policies, or practices of those websites, and you access them at your own risk.</p>
    <h2>Disclaimer &amp; Limitation of Liability</h2>
    <p>This site is provided "as is" without warranties of any kind. We are not liable for any damages resulting from your use of this site.</p>
    <h2>Governing Law</h2>
    <p>These Terms shall be governed by and interpreted in accordance with the laws of your local jurisdiction.</p>
    <h2>Contact Information</h2>
    <p>If you have any questions about these Terms, please contact us using the contact information on our website.</p>
  `,
};

const StaticPage = ({ labels, pageName }: StaticPageProps) => {
  const content = labels.content || DEFAULTS[pageName] || "";

  return (
    <>
      <main className="pt-24 pb-20">
        <section className="pt-10 pb-16">
          <div className="content-grid space-y-8 max-w-4xl mx-auto prose prose-headings:font-display prose-headings:font-bold">
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
              {labels.title}
            </h1>
            <div dangerouslySetInnerHTML={{ __html: content }} />
          </div>
        </section>
        <CTASection />
      </main>
    </>
  );
};

export default StaticPage;
