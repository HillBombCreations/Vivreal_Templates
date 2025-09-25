
import React from 'react';
import FeatureCard from './FeatureCard';
import { Code, Layers, Globe, Lock, Zap, FileText } from 'lucide-react';

const FeaturesSection = () => {
  const features = [
    {
      icon: Layers,
      title: 'Reusable, Flexible Content',
      description: 'Create content once and adapt it to fit different needs, helping your team save time and stay consistent.',
      className: "text-green-700", 
    },
    {
      icon: Globe,
      title: 'Publish Everywhere',
      description: 'Distribute your content seamlessly across websites, apps, and devices to reach your audience wherever they are.',
      className: "text-blue-700",
    },
    {
      icon: Lock,
      title: 'Secure & Reliable',
      description: "Built with strong security and dependable availability to support your business's content needs.",
      className: "text-purple-700",
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-secondary/50 relative overflow-hidden">
      <div className="content-grid">
        <div className="text-center max-w-3xl mx-auto mb-16 animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-4">
            Everything you need <span className="text-primary">to manage content</span>
          </h2>
          <p className="text-gray-800 text-lg max-w-2xl mx-auto">
            Our platform provides all the tools you need to create, manage, and deliver content across all your digital channels.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={100 * (index + 1)}
              iconClassName={feature.className} 
            />
          ))}
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="absolute -z-10 top-40 -left-20 h-64 w-64 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -z-10 bottom-20 right-10 h-80 w-80 bg-primary/5 rounded-full blur-3xl"></div>
    </section>
  );
};

export default FeaturesSection;
