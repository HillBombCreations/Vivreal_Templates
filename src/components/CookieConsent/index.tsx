import React, { useState, useEffect } from 'react';
import { Button } from '../UI/Button';
import Link from 'next/link';
import { X } from 'lucide-react';
import { SiteData } from '@/types/SiteData';

const COOKIE_KEY = 'cookie_consent_v1';

type CookieConsentProps = {
  onAccept: () => void;
  onReject: () => void;
  siteData: SiteData;
};

const CookieConsent: React.FC<CookieConsentProps> = ({ onAccept, onReject, siteData }) => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent && !dismissed) setOpen(true);
  }, [dismissed]);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, 'accepted');
    setOpen(false);
    onAccept();
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_KEY, 'rejected');
    setOpen(false);
    onReject();
  };

  const handleClose = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (!open) return null;

  return (
    <div
      className="fixed bottom-4 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ maxWidth: '100vw' }}
      role="region"
      aria-label="Cookie consent notification"
    >
      <div
        className="relative border shadow-lg rounded-xl p-6 w-full max-w-md mx-4 pointer-events-auto flex flex-col"
        style={{ background: siteData?.surface, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
      >
        <button
          className="absolute cursor-pointer right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={handleClose}
          aria-label="Close cookie consent"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-2">
          <h2 className="text-lg font-semibold leading-none tracking-tight mb-1">We use cookies</h2>
          <p style={{ color: siteData?.['text-primary'] }} className="text-sm">
            We use cookies and similar technologies to enhance your experience, analyze site usage, and assist in our marketing efforts. See our{' '}
            <Link href="/privacy" className="underline text-primary" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> for more info.
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button style={{ color: siteData?.primary, cursor: 'pointer' }} onClick={handleReject} variant="outline">Reject</Button>
          <Button style={{ background: siteData?.primary, color: siteData?.["text-inverse"], cursor: 'pointer' }} onClick={handleAccept}>Accept</Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent; 