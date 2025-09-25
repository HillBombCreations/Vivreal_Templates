
import { cn } from '@/lib/utils';

interface ClientLogoProps {
  name?: string;
  logoUrl?: string;
  delay?: number;
  className?: string;
}

const ClientLogo = ({ name, logoUrl, delay = 0, className }: ClientLogoProps) => {
  return (
    <div 
      className={cn(
        "h-12 px-6 flex items-center justify-center grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300",
        className
      )}
      style={{ 
        animationDelay: `${delay}ms`,
        opacity: 0,
        animation: `fade-in 0.6s ease-out ${delay}ms forwards` 
      }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={name || "Company logo"} className="h-8 object-contain" />
      ) : (
        <span className="font-display font-semibold tracking-tight text-xl">{name}</span>
      )}
    </div>
  );
};

export default ClientLogo;
