import Head from 'next/head';
import Navbar from '@/components/Navigation/Navbar';
import {
    getSiteData
} from '@/lib/api/siteData';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import EmailListComponent from '@/components/EmailListComponent';
import HeroSection from '@/components/HeroSection';
import { getShows } from '@/lib/api/shows';

const Index = async () => {
    const siteData = await getSiteData();
    const showData = await getShows();
    return (
        <div className='min-h-screen overflow-x-hidden' style={{ backgroundColor: siteData?.surface }}>
            <Head>
                <title>The Comedy Collective Chicago</title>
                <meta name='description' content='The Comedy Collective Chicago' />
                <link rel='canonical' href={'https://www.comedycollectivechi.com'} />
            </Head>
            <Navbar />
            <EmailListComponent />
            <HeroSection shows={showData} />
            <CTASection />
            <Footer />
        </div>
    );
};

export default Index;

export const generateMetadata = async () => {
  const siteData = await getSiteData();
  return {
    title: "The Comedy Collective",
    description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
    openGraph: {
      title: "The Comedy Collective",
      description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
      url: "https://comedycollectivechi.com/",
      images:  [
        {
            url: new URL(siteData?.logo.currentFile.source),
            width: 1200,
            height: 630,
            alt: "The Comedy Collective Logo",
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: "The Comedy Collective",
      description: "The Comedy Collective is a place for discovering and enjoying the best in comedy.",
      images: [new URL(siteData?.logo.currentFile.source)]
    },
  };
}