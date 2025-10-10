import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import ContactClient from './ContactClient';

const ContactPage = () => {
  return (
    <>
      <Head>
        <title>Contact Us | Vivreal</title>
        <meta
          name="description"
          content="Reach out to Vivreal to discuss how we can expedite your business workflows for Community Managers, Marketing Specialists, and Developers."
        />
        <link rel="canonical" href={'https://www.vivreal.io/contact'} />
      </Head>
      <Navbar />
      <ContactClient />
      <Footer />
    </>
  );
};

export default ContactPage;

export const generateMetadata = async () => {
  return {
    title: "Contact Us",
    description:
      "Get in touch with our team. We're here to answer your questions, provide support, and help you get started.",
    openGraph: {
      title: "Contact Us",
      description:
        "Have a question or need assistance? Reach out through our contact page and we'll be happy to help.",
      url: "/contact",
      images: [
        {
          url: "/contact-meta.png",
          width: 1200,
          height: 630,
          alt: "Contact page preview",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Contact Us",
      description:
        "Get support, ask questions, or send us a message through our contact page.",
      images: ["/contact-meta.png"],
    },
  };
};
