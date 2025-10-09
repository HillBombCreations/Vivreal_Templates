"use client";

import React, { useState, useEffect } from 'react';
import Head from "next/head";
import Navbar from '@/components/Navigation/Navbar';
import Footer from '@/components/Footer';
import axios from 'axios';
import { Button } from '@/components/Button';
import { useSiteData } from '@/contexts/SiteDataContext';
import CTASection from '@/components/CTASection';
import {
  Users,
  BarChart2,
  Code,
} from 'lucide-react';

const roles = [
  {
    id: 'community-manager',
    title: 'Community Manager',
    icon: Users,
    points: [
      'Engage your audience without developer delays.',
      'Easily manage live updates and dynamic content on your terms.',
      'Stay connected with your audience using intuitive publishing tools.',
    ],
  },
  {
    id: 'marketing-specialist',
    title: 'Marketing Specialist',
    icon: BarChart2,
    points:  [
      'Move from idea to campaign launch in minutes, not days.',
      'Test, iterate, and publish without waiting for engineering.',
      'Unify content and analytics to refine messaging in real time.',
    ],
  },
  {
    id: 'developer',
    title: 'Developer',
    icon: Code,
    points: [
      'Focus on building not babysitting content updates.',
      'Empower non-technical teams without compromising flexibility.',
      'Integrate seamlessly with your stack through robust APIs.',
    ],
  },
];

const ContactPage = () => {
  const siteData = useSiteData();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_MAIN_API;

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.subject.trim()) newErrors.subject = 'Subject is required';
    if (!formData.message.trim()) newErrors.message = 'Message is required';

    return newErrors;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setError(false);
    setSuccess(false);
    
    try {
      await axios.post(
          `${API_URL}/api/sendContactUsEmail`,
          {
            name: formData.name,
            email: formData.email,
            message: formData.message,
            subject: formData.subject
          },
      );
      setSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      setError(true);
      console.error('Error sending message:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  
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

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="max-w-7xl mx-5 md:mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-start">
          <div className="space-y-10">
            <div>
              <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-4">
                <span style={{ color: siteData?.["text-primary"] }}>Contact</span> Us
              </h1>
              <p style={{ color: siteData?.["text-primary"] }} className="text-md md:text-lg max-w-md">
                Discover how Vivreal can accelerate your content workflows and streamline collaboration across your team.
              </p>
            </div>
            {
              !isMobile  && (
                <>
                  {roles.map(({ id, title, icon: Icon, points }) => (
                    <div key={id} className="space-y-3">
                      <div className="flex items-center gap-3 mb-2">
                        <Icon style={{ color: siteData?.primary }} className="w-7 h-7" />
                        <h2 className="text-2xl font-semibold">{title}</h2>
                      </div>
                      <ul style={{ color: siteData?.["text-primary"] }} className="list-disc list-inside space-y-1 max-w-xl">
                        {points.map((point, i) => (
                          <li key={i} className="leading-relaxed">{point}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              )
            }
            
          </div>
          <div style={{ background: siteData?.surface }} className="p-8 rounded-xl shadow-lg    animate-fade-in max-w-md w-full mx-auto">
            {success && (
              <div className="mb-6 rounded-lg bg-green-100 text-green-800 p-4 text-center">
                We&apos;ve received your message and will be in touch shortly. Please keep an eye on your email and don&apos;t forget to check your spam or junk folder, just in case.
              </div>
            )}

            {error && (
              <div className="mb-6 rounded-lg bg-red-100 text-red-800 p-4 text-center">
                Something went wrong. Please try again, and if the problem persists you can reach us directly at{" "}
                <a href="mailto:hello@vivreal.io" className="underline font-medium">
                  hello@vivreal.io
                </a>.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <div>
                <label htmlFor="name" className="block mb-2 font-semibold">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.name ? 'border-red-700' : 'border-gray-300'
                  }`}
                  placeholder="Your full name"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              <div>
                <label htmlFor="email" className="block mb-2 font-semibold">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.email ? 'border-red-700' : 'border-gray-300'
                  }`}
                  placeholder="your.email@example.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="subject" className="block mb-2 font-semibold">
                  Subject
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                    errors.subject ? 'border-red-700' : 'border-gray-300'
                  }`}
                  placeholder="Subject of your message"
                />
                {errors.subject && <p className="mt-1 text-sm text-red-600">{errors.subject}</p>}
              </div>

              <div>
                <label htmlFor="message" className="block mb-2 font-semibold">
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={6}
                  value={formData.message}
                  onChange={handleChange}
                  className={`w-full rounded-md border px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none ${
                    errors.message ? 'border-red-700' : 'border-gray-300'
                  }`}
                  placeholder="Write your message here..."
                />
                {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
              </div>

              <div className="text-center">
                <Button style={{ background: siteData?.primary, color: siteData?.["text-inverse"], cursor: 'pointer' }} type="submit" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </div>
        </section>

        <CTASection page="Contact" />
      </main>

      <Footer />
    </>
  );
};

export default ContactPage;