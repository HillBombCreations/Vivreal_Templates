import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import AboutClient from "./AboutClient";

const AboutPage = async () => {
  return (
    <>
      <Navbar />
      <AboutClient />   
      <CTASection />
      <Footer />
    </>
  );
};

export default AboutPage;

export const generateMetadata = async () => {
    return {
    title: "The Comedy Collective Team",
    description: "Meet the team behind The Comedy Collective. We're dedicated to bringing you the best in comedy through our platform and community.",
    openGraph: {
      title: "The Comedy Collective Team",
      description: "Meet the team behind The Comedy Collective. We're dedicated to bringing you the best in comedy through our platform and community.",
      url: "https://comedycollectivechi.com/solutions",
      images: [
        {
          url: new URL("/meetTheTeamThumbnail.png", "https://comedycollectivechi.com"),
          width: 1200,
          height: 630,
          alt: "The Comedy Collective Team",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "The Comedy Collective Team",
      description: "Meet the team behind The Comedy Collective. We're dedicated to bringing you the best in comedy through our platform and community.",
      images: [
        new URL("/meetTheTeamThumbnail.png", "https://comedycollectivechi.com"),
      ],
    },
  }
};