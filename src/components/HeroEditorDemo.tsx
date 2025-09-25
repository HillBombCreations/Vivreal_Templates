import { useState, useEffect } from 'react';
import axios from 'axios';
import { renderToString } from 'react-dom/server';
import { Button } from '@/components/ui/button';
import HeroSection from '@/components/HeroSection';
import FeaturesSection from '@/components/FeaturesSection';
import SolutionsSection from '@/components/SolutionsSection';
import FeaturesGifSection from '@/components/FeaturesGifSection';
import FileUpload from './FileUpload';
import WhatWeDoSection from '@/components/WhatWeDoSection';
import TeamSync from '@/components/TeamSync';

interface HeroValues {
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  buttonText: string;
  sectionMargin: string;
  titleSize: string;
  subtitleSize: string;
  buttonSize: string;
  buttonSubText: string;
  pointColumns: string;
  pointIconSize: string;
  pointTitleSize: string;
  pointDescSize: string;
  pointsMarginTop: string;
}

interface ParamHeroValues extends HeroValues {
  heroImage: {
    name: string;
    source: string;
  };
}

const checkRegisterValue = async (value: string) => {
  return await axios
    .get('https://api.vivreal.io/api/user/checkRegisterValue', {
      params: { value, type: 'email' },
    })
};

const EmailModal = ({
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (email: string) => void;
}) => {
  const [email, setEmail] = useState('');

  return (
    <div className='absolute inset-0 flex items-center justify-center z-2'>
      <div className='bg-white rounded-xl shadow-lg p-6 max-w-sm w-full'>
        <h2 className='text-xl font-semibold mb-3'>Unlock the Demo</h2>
        <p className='text-sm text-gray-600 mb-4'>
          Enter your email to continue.
        </p>
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com'
          className='w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500'
        />
        <div className='flex justify-end gap-2'>
          <Button onClick={() => onSubmit(email)} disabled={!email}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};

const HeroEditorDemo = () => {
  const [draftValues, setDraftValues] = useState<HeroValues>({
    titleLine1: 'Scale Your Business',
    titleLine2: 'Not Your Budget',
    subtitle:
      'A modern content management platform to create, edit, and publish content everywhere easy for teams, built to scale with you',
    buttonText: 'Create Your Free Account',
    sectionMargin: 'mx-10',
    titleSize: 'text-3xl',
    subtitleSize: 'text-sm',
    buttonSize: 'px-4 py-2 text-sm',
    buttonSubText: 'text-xs',
    pointColumns: 'md:grid-cols-4',
    pointIconSize: 'md:h-7 md:w-7',
    pointTitleSize: 'md:text-md',
    pointDescSize: 'md:text-xs',
    pointsMarginTop: 'md:mt-5',
  });

  const [heroImage, setHeroImage] = useState<{ name: string; source: string }>({
    name: 'heroImage.png',
    source: '/heroImage.png',
  });

  const [appliedValues, setAppliedValues] = useState<ParamHeroValues>({
    ...draftValues,
    heroImage,
  });

  const [html, setHtml] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailCaptured, setEmailCaptured] = useState<boolean>(() => {
    return localStorage.getItem('emailCaptured') === 'true';
  });

  const handleDraftChange = (field: keyof HeroValues, value: string) => {
    setDraftValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (value: { name: string; source: string }) => {
    if (!emailCaptured) {
      setShowEmailModal(true);
      return;
    }
    const copiedAppliedValues = JSON.parse(JSON.stringify(appliedValues));
    copiedAppliedValues.heroImage = value;

    setHeroImage(value);
    setAppliedValues(copiedAppliedValues);
  };

  const handleApply = () => {
    if (!emailCaptured) {
      setShowEmailModal(true);
      return;
    }
    setAppliedValues({
      ...draftValues,
      heroImage,
    });
  };

  const handleEmailSubmit = (email: string) => {
    checkRegisterValue(email).then((res) => {
      localStorage.setItem('emailCaptured', 'true');
      setEmailCaptured(true);
      setShowEmailModal(false);
    });
  };

  const handleClearFileChange = () => {
    const defaultVal = {
      name: 'heroImage.png',
      source: '/heroImage.png',
    };
    const copiedAppliedValues = JSON.parse(JSON.stringify(appliedValues));
    copiedAppliedValues.heroImage = defaultVal;

    setHeroImage(defaultVal);
    setAppliedValues(copiedAppliedValues);
  };

  useEffect(() => {
    const buildIframeHtml = () => {
      const PreviewPage = () => (
        <div
          style={{
            transform: 'scale(0.75)',
            transformOrigin: 'top left',
            width: '133.33%',
          }}
        >
          <div className='min-h-screen bg-background overflow-x-hidden'>
            <header className='fixed top-0 left-0 right-0 z-50 bg-white border-b py-4 px-4 md:px-6 flex items-center justify-between shadow-sm'>
              <div className='flex items-center flex-shrink-0'>
                <img src='/vivreallogo.svg' alt='Logo' className='h-6 md:h-8' />
              </div>
              <nav className='flex items-center flex-1 justify-center flex-shrink gap-3 md:gap-6 text-sm md:text-base'>
                <span className='cursor-pointer hover:text-blue-600'>Features</span>
                <span className='cursor-pointer hover:text-blue-600'>Solutions</span>
                <span className='cursor-pointer hover:text-blue-600'>Developers</span>
                <span className='cursor-pointer hover:text-blue-600'>Pricing</span>
              </nav>
              <div className='flex items-center gap-2 flex-shrink-0'>
                <Button variant='outline' size='sm'>Contact Us</Button>
                <Button size='sm'>Log in</Button>
              </div>
            </header>
            <main>
              <HeroSection {...appliedValues} />
              <FeaturesGifSection />
              <TeamSync />
              <SolutionsSection />
              <FeaturesSection />
              <WhatWeDoSection />
            </main>
          </div>
        </div>
      );

      let previewHtml = renderToString(<PreviewPage />);
      previewHtml = previewHtml.replace(/href="[^"]*"/gi, '');

      const styleNodes = Array.from(
        document.querySelectorAll<
          HTMLLinkElement | HTMLStyleElement
        >('link[rel=stylesheet], style')
      );
      const styles = styleNodes.map((node) => node.outerHTML).join('\n');

      return `
        <!DOCTYPE html>
        <html lang='en'>
          <head>
            <meta charset='UTF-8' />
            <meta name='viewport' content='width=device-width, initial-scale=1.0' />
            ${styles}
          </head>
          <body>
            <div id='root'>${previewHtml}</div>
          </body>
        </html>
      `;
    };

    setHtml(buildIframeHtml());
  }, [appliedValues]);

  return (
    <section className='relative bg-white pt-16 pb-20 overflow-hidden'>
      <div className='mx-5 md:mx-20 lg:mx-32'>
        <div className='text-center mb-5 md:mb-12'>
          <h2 className='text-3xl md:text-4xl font-display font-bold tracking-tight'>
            Experience <span className='text-primary'>Content Management</span>{' '}
            in Action
          </h2>
          <p className='text-gray-800 text-lg mt-2 max-w-xl mx-auto'>
            Explore our live demo and see how effortlessly you can create, edit, and publish content.
          </p>
        </div>
        <div className='grid lg:grid-cols-2 gap-10 items-start'>
          <div>
            <h3 className='text-xl font-semibold mb-4'>Edit Hero Section</h3>
            <form className='space-y-5'>
              {(
                [
                  ['titleLine1', 'Title Line 1'],
                  ['titleLine2', 'Title Line 2'],
                  ['subtitle', 'Subtitle'],
                  ['buttonText', 'Button Text'],
                ] as [keyof HeroValues, string][]
              ).map(([field, label]) => (
                <div key={field}>
                  <label className='block font-medium text-sm mb-1'>
                    {label}
                  </label>
                  <input
                    type='text'
                    value={draftValues[field]}
                    onChange={(e) =>
                      handleDraftChange(field, e.target.value)
                    }
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none'
                  />
                </div>
              ))}
              <div className='flex justify-between gap-2'>
                <FileUpload
                  value={heroImage}
                  onChange={(file, previewUrl) =>
                    handleFileChange({ source: previewUrl, name: file.name })
                  }
                  onClear={handleClearFileChange}
                />
                <Button type='button' onClick={handleApply}>
                  Apply Changes To Preview
                </Button>
              </div>
            </form>
          </div>
          <div className='rounded-xl overflow-hidden border shadow-lg animate-fade-in' style={{ animationDelay: '300ms' }}>
            <div className='flex items-center gap-2 bg-gray-100 px-3 py-2 border-b'>
              <span className='w-3 h-3 bg-red-500 rounded-full' />
              <span className='w-3 h-3 bg-yellow-500 rounded-full' />
              <span className='w-3 h-3 bg-green-500 rounded-full' />
              <div className='flex-1 bg-white rounded px-2 text-xs text-gray-600 truncate'>
                https://www.vivireal.io
              </div>
            </div>
            <iframe
              title='Preview'
              srcDoc={html}
              className='w-full h-[600px] border-none'
            />
          </div>
        </div>
        
        {showEmailModal && !emailCaptured && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-sm'>
            <EmailModal
              onClose={() => setShowEmailModal(false)}
              onSubmit={handleEmailSubmit}
            />
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroEditorDemo;
