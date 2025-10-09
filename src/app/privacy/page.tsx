import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import CTASection from '@/components/CTASection';

export const metadata = {
  title: "Privacy Policy | Vivreal",
  description:
    "Read Vivreal's privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
  alternates: {
    canonical: "https://www.vivreal.io/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Vivreal",
    description:
      "Read Vivreal's privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
    url: "https://www.vivreal.io/privacy",
    images: [
      {
        url: "https://www.vivreal.io/vrlogo.png",
        width: 1200,
        height: 630,
        alt: "Privacy Policy | Vivreal",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | Vivreal",
    description:
      "Read Vivreal's privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security.",
    images: ["https://www.vivreal.io/vrlogo.png"],
  },
};

const PrivacyPolicy = () => {

  return (
    <>
      <Head>
        <title>Vivreal Privacy Policy | Data Protection & User Rights</title>
        <meta name="description" content="Read Vivreal's privacy policy to learn how we collect, use, and protect your data. Understand your rights and our commitment to user privacy and security." />
        <link rel="canonical" href={'https://www.vivreal.io/privacy'} />
      </Head>
      
      <Navbar />
      
      <main className="pt-24 pb-20">
        <section className="pt-10 pb-16">
          <div className="content-grid">
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">Privacy Policy for Vivreal</h1>
              <p className="text-gray-800 mb-2">
                  At Vivreal, accessible from https://www.vivreal.io, one of our main priorities is the privacy of our visitors. This Privacy Policy document contains types of information that is collected and recorded by Vivreal and how we use it.
              </p>
              <p className="text-gray-800 mb-2">
                  If you have additional questions or require more information about our Privacy Policy, do not hesitate to contact us.
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Log Files</h2>
              <p className="text-gray-800 mb-2">
                  Vivreal follows a standard procedure of using log files. These files log visitors when they visit websites. All hosting companies do this and a part of hosting services&apos; analytics. The information collected by log files include internet protocol (IP) addresses, browser type, Internet Service Provider (ISP), date and time stamp, referring/exit pages, and possibly the number of clicks. These are not linked to any information that is personally identifiable. The purpose of the information is for analyzing trends, administering the site, tracking users&apos; movement on the website, and gathering demographic information.
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Cookies and Web Beacons</h2>
              <p className="text-gray-800 mb-2">
                  Like any other website, Vivreal uses &quot;cookies&quot;. These cookies are used to store information including visitors&apos; preferences, and the pages on the website that the visitor accessed or visited. The information is used to optimize the users&apos; experience by customizing our web page content based on visitors&apos; browser type and/or other information.
              </p>
              <p className="text-gray-800 mb-2">
                <strong>Analytics and tracking cookies (such as Google Analytics and Microsoft Clarity) are only set with your explicit consent via our cookie popup. You can accept or reject these cookies at any time. If you reject, these analytics and tracking cookies will not be set in your browser.</strong>
              </p>
              <p className="text-gray-800 mb-2">
                  For more general information on cookies, please read <a href="https://www.privacypolicyonline.com/what-are-cookies/">the &quot;Cookies&quot; article from the Privacy Policy Generator</a>.
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Privacy Policies</h2>
              <p className="text-gray-800 mb-2">
                  You may consult this list to find the Privacy Policy for each of the advertising partners of Vivreal.
              </p>
              <p className="text-gray-800 mb-2">
                  Third-party ad servers or ad networks uses technologies like cookies, JavaScript, or Web Beacons that are used in their respective advertisements and links that appear on Vivreal, which are sent directly to users&apos; browser. They automatically receive your IP address when this occurs. These technologies are used to measure the effectiveness of their advertising campaigns and/or to personalize the advertising content that you see on websites that you visit.
              </p>
              <p className="text-gray-800 mb-2">
                  Note that Vivreal has no access to or control over these cookies that are used by third-party advertisers.
              </p>
              <h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Third Party Privacy Policies</h2>
              <p className="text-gray-800 mb-2">
                  Vivreal&apos;s Privacy Policy does not apply to other advertisers or websites. Thus, we are advising you to consult the respective Privacy Policies of these third-party ad servers for more detailed information. It may include their practices and instructions about how to opt-out of certain options. </p><p className="text-gray-800 mb-2">You can choose to disable cookies through your individual browser options. To know more detailed information about cookie management with specific web browsers, it can be found at the browsers&apos; respective websites. What Are Cookies?</p><h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Children&apos;s Information</h2><p className="text-gray-800 mb-2">Another part of our priority is adding protection for children while using the internet. We encourage parents and guardians to observe, participate in, and/or monitor and guide their online activity.</p><p className="text-gray-800 mb-2">Vivreal does not knowingly collect any Personal Identifiable Information from children under the age of 13. If you think that your child provided this kind of information on our website, we strongly encourage you to contact us immediately and we will do our best efforts to promptly remove such information from our records.</p><h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Online Privacy Policy Only</h2><p className="text-gray-800 mb-2">This Privacy Policy applies only to our online activities and is valid for visitors to our website with regards to the information that they shared and/or collect in Vivreal. This policy is not applicable to any information collected offline or via channels other than this website.</p><h2 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-6 text-center mt-6">Consent</h2><p className="text-gray-800 mb-2">By using our website, you hereby consent to our Privacy Policy and agree to its Terms and Conditions.
              </p>
              <p className="text-gray-800 mb-2">
                  We partner with Microsoft Clarity and Microsoft Advertising to capture how you use and interact with our website through behavioral metrics, heatmaps, and session replay to improve and market our products/services. Website usage data is captured using first and third-party cookies and other tracking technologies to determine the popularity of products/services and online activity. Additionally, we use this information for site optimization, fraud/security purposes, and advertising. For more information about how Microsoft collects and uses your data, visit the <a href="https://www.microsoft.com/en-us/privacy/privacystatement">Microsoft Privacy Statement</a>.
              </p>
              <p className="text-gray-800 mb-2">
                  When you visit or log in to our website, cookies  and similar technologies may be used by our online data partners or vendors to associate these activities with other personal information they or others have about you, including by association with your email. We (or service providers on our behalf) may then send communications and marketing to these email. You may opt out of receiving this advertising by visiting <a href="https://app.retention.com/optout">https://app.retention.com/optout</a>
              </p>
          </div>
        </section>
        
        <CTASection page="privacy"/>
      </main>
      
      <Footer />
    </>
  );
};

export default PrivacyPolicy;
