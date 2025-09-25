import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
  iconClassName?: string;
}

const FeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  delay = 0,
  iconClassName
}: FeatureCardProps) => {
  return (
    <div 
      className={cn(
        "flex flex-col items-center md:items-start mb-2 md:mb-0 lg:mb-0 space-y-3"
      )}
      style={{ 
        animationDelay: `${delay}ms`,
        opacity: 0,
        animation: `fade-in-up 0.7s ease-out ${delay}ms forwards` 
      }}
    >
      <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center mb-0">
        <Icon size={28} className={`text-primary`} />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-gray-800 text-center md:text-start text-sm max-w-xs">{description}</p>
    </div>
  );
};

export default FeatureCard;