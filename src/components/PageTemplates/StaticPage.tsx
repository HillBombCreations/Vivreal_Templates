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
    <p>Your privacy matters to us. This Privacy Policy describes what information we collect, why we collect it, how we use it, and the choices available to you.</p>
    <h2>Information We Collect</h2>
    <p>We may collect personal information you voluntarily provide — such as your name, email address, shipping address, and payment details — when you make a purchase, submit a form, or contact us. We also automatically collect certain technical data including your browser type, device, IP address, and pages visited to help us improve the site.</p>
    <h2>How We Use Your Information</h2>
    <p>We use the information we collect to process orders and payments, respond to your inquiries, send order confirmations and updates, improve our website and services, and comply with legal obligations. We do not sell or rent your personal information to third parties.</p>
    <h2>Payment Processing</h2>
    <p>All payments are processed securely through Stripe. We do not store your credit card information on our servers. Stripe's privacy policy governs how your payment data is handled.</p>
    <h2>Cookies &amp; Tracking</h2>
    <p>Our website uses cookies and similar technologies to remember your preferences, keep items in your cart, and understand how visitors use our site. You can manage cookie preferences in your browser settings. Disabling cookies may affect certain site features.</p>
    <h2>Third-Party Services</h2>
    <p>We may use third-party services for analytics, payment processing, email delivery, and hosting. Each provider operates under its own privacy policy. We only share information necessary for these services to function.</p>
    <h2>Data Retention</h2>
    <p>We retain your personal information for as long as necessary to fulfill the purposes described in this policy, comply with legal requirements, and resolve disputes. You may request deletion of your data by contacting us.</p>
    <h2>Your Rights</h2>
    <p>Depending on your location, you may have the right to access, correct, delete, or export your personal data. You may also opt out of marketing communications at any time. To exercise these rights, please contact us using the information on our website.</p>
    <h2>Children's Privacy</h2>
    <p>Our services are not directed at children under the age of 13, and we do not knowingly collect personal information from children.</p>
    <h2>Changes to This Policy</h2>
    <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date. Your continued use of the site constitutes acceptance of the revised policy.</p>
    <h2>Contact Us</h2>
    <p>If you have questions about this Privacy Policy or how your information is handled, please reach out to us through the contact information on our website.</p>
  `,
  terms: `
    <p>Welcome. By accessing or using this website, you agree to be bound by these Terms of Service. If you do not agree, please do not use the site.</p>
    <h2>Use of the Site</h2>
    <p>You are granted a limited, non-exclusive, non-transferable license to access and use this site for personal and commercial purposes as intended (e.g., browsing, purchasing products). You agree not to misuse the site, interfere with its operation, or use it for any unlawful purpose.</p>
    <h2>Accounts &amp; Orders</h2>
    <p>When you place an order, you agree to provide accurate and complete information. You are responsible for maintaining the confidentiality of any account credentials. We reserve the right to refuse or cancel orders at our discretion, including in cases of pricing errors, suspected fraud, or product unavailability.</p>
    <h2>Pricing &amp; Payments</h2>
    <p>All prices are listed in USD unless otherwise stated. Prices are subject to change without notice. Payment is processed securely through Stripe at the time of purchase. You agree to pay all charges associated with your order, including applicable taxes and shipping fees.</p>
    <h2>Shipping &amp; Delivery</h2>
    <p>Shipping times and costs vary by location and are displayed at checkout. We are not responsible for delays caused by carriers, customs, or events beyond our control. Risk of loss passes to you upon delivery to the carrier.</p>
    <h2>Returns &amp; Refunds</h2>
    <p>Our return and refund policy, if applicable, is described separately on our website. If no specific policy is posted, please contact us directly to discuss returns or issues with your order.</p>
    <h2>Intellectual Property</h2>
    <p>All content on this site — including text, images, logos, and design — is owned by us or our licensors and is protected by copyright and trademark laws. You may not copy, distribute, modify, or commercially exploit any content without prior written permission.</p>
    <h2>Third-Party Links</h2>
    <p>This site may contain links to third-party websites or services. We are not responsible for the content, accuracy, or practices of those sites. Accessing them is at your own risk.</p>
    <h2>Disclaimer of Warranties</h2>
    <p>This site and its content are provided "as is" and "as available" without warranties of any kind, express or implied. We do not guarantee that the site will be uninterrupted, error-free, or free of harmful components.</p>
    <h2>Limitation of Liability</h2>
    <p>To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the site, including but not limited to loss of data, revenue, or profits.</p>
    <h2>Governing Law</h2>
    <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the business operates, without regard to conflict of law principles.</p>
    <h2>Changes to These Terms</h2>
    <p>We reserve the right to update these Terms at any time. Changes take effect when posted. Your continued use of the site after changes constitutes acceptance of the updated Terms.</p>
    <h2>Contact Us</h2>
    <p>If you have questions about these Terms, please contact us using the information on our website.</p>
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
      </main>
    </>
  );
};

export default StaticPage;
