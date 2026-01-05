import Head from "next/head";
import CTASection from "@/components/CTASection";

export const metadata = {
  title: "Privacy Policy",
  description:
    "Read our privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy",
    description:
      "Read our privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
    url: "/privacy",
    images: [
      {
        url: "/privacy-meta.png",
        width: 1200,
        height: 630,
        alt: "Privacy Policy",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy",
    description:
      "Read our privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
    images: ["/privacy-meta.png"],
  },
};

const PrivacyPolicy = () => {
  return (
    <>
      <Head>
        <title>Privacy Policy | Template</title>
        <meta
          name="description"
          content="Read our privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security."
        />
        <link rel="canonical" href={"/privacy"} />
      </Head>

      <main className="pt-24 pb-20">
        <section className="pt-10 pb-16">
          <div className="content-grid space-y-8 max-w-4xl mx-auto">
            {/* Intro */}
            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-gray-700">
              Your privacy is important to us. This Privacy Policy explains the
              types of information we collect, how it is used, and the choices
              you have regarding your data.
            </p>

            {/* Data Collection */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Information We Collect
              </h2>
              <p className="text-gray-700">
                We may collect personal details such as your name, email
                address, and messages submitted through our contact forms, as
                well as non-identifiable information like browser type and
                usage patterns.
              </p>
            </div>

            {/* Cookies */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Cookies & Tracking
              </h2>
              <p className="text-gray-700">
                Our website may use cookies to improve your experience, analyze
                traffic, and remember preferences. You can choose to disable
                cookies in your browser settings if preferred.
              </p>
            </div>

            {/* Third Parties */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Third-Party Services
              </h2>
              <p className="text-gray-700">
                We may use third-party tools for analytics or marketing
                purposes. These providers have their own privacy policies, and
                we recommend reviewing them to understand how they handle your
                information.
              </p>
            </div>

            {/* Children’s Privacy */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">
                Children&apos;s Privacy
              </h2>
              <p className="text-gray-700">
                Our services are not directed at children under the age of 13,
                and we do not knowingly collect personal information from
                children.
              </p>
            </div>

            {/* Consent */}
            <div>
              <h2 className="text-2xl font-display font-bold mb-3">Consent</h2>
              <p className="text-gray-700">
                By using this website, you consent to our Privacy Policy and
                agree to its terms.
              </p>
            </div>
          </div>
        </section>

        <CTASection />
      </main>
    </>
  );
};

export default PrivacyPolicy;