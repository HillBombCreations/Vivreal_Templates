
import React from 'react';
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from '@/lib/utils';

interface TestimonialCardProps {
  content: string;
  name: string;
  role: string;
  imageUrl?: string;
  delay?: number;
  className?: string;
}

const TestimonialCard = ({ 
  content, 
  name, 
  role, 
  delay = 0,
  className
}: TestimonialCardProps) => {
  return (
    <div 
      className={cn(
        "bg-card rounded-xl p-6 border shadow-sm",
        className
      )}
      style={{ 
        animationDelay: `${delay}ms`,
        opacity: 0,
        animation: `fade-in-up 0.7s ease-out ${delay}ms forwards`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between' 
      }}
    >
      <p className="text-gray-800 mb-6 text-sm leading-relaxed italic">"{content}"</p>
      <div className="flex items-center ">
        <Avatar className="h-10 w-10 border">
          <AvatarFallback>{name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="ml-3">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-gray-800">{role}</p>
        </div>
      </div>
    </div>
  );
};

export default TestimonialCard;
