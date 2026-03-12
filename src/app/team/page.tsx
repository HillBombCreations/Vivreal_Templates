import Navbar from "@/components/Navigation/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import AboutClient from "./AboutClient";
import { getTeamMembers } from "@/lib/api/team";
import { getSiteData } from "@/lib/api/siteData";

const AboutPage = async () => {
  const teamMembers = await getTeamMembers();
  return (
    <>
      <Navbar />
      <AboutClient teamMembers={teamMembers} />
      <CTASection />
      <Footer />
    </>
  );
};

export default AboutPage;

export const generateMetadata = async () => {
  const siteData = await getSiteData();
  const siteName = siteData?.businessInfo?.name || siteData?.name || '';

  return {
    title: `Our Team | ${siteName}`,
    description: `Meet the team behind ${siteName}. We're dedicated to delivering the best experience.`,
  };
};
