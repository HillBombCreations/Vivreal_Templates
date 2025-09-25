
import { useEffect, useRef, useState, FC } from 'react';
import { LucideIcon } from 'lucide-react';
import { iconMap } from "@/lib/utils";
import GetStartedButton from './GetStartedButton';

interface PointCardProps {
  icon: LucideIcon;
  iconString: string;
  title: string;
  description: string;
  delay?: number;
  className?: string;
}

interface HeroSectionProps {
  page?: string;
}

const HeroSection: FC<HeroSectionProps> = ({
  page,
}) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [imageSize, setImageSize] = useState("w-full h-auto");
  const [pageLayout, setPageLayout] = useState(null);
  const [heroSectionObj, setHeroSectionObj] = useState(null);
  const [siteData, setSiteData] = useState(null);
  const localPointColumns = "md:grid-cols-2 lg:grid-cols-4";
  const localTitleSize = "text-3xl md:text-xl 2xl:text-5xl";
  const localSubtitleSize = "text-md 2xl:text-lg";
  const localSectionMargin = "mx-5 md:mx-40 lg:mx-50";
  const localButtonSubText = "text-sm";

  const localPointIconSize = "w-8 h-8";
  const localPointTitleSize = "text-lg sm:text-md md:text-lg";
  const localPointDescSize = "text-sm";
  const localPointsMarginTop = "mt-14"

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    fetch("/data/heroSectionData.json")
      .then((res) => res.json())
      .then((data) => {
        const mappedPoints = data.dataPoints.map((point: PointCardProps) => ({
          ...point,
          icon: iconMap[point.iconString] || (() => null),
        }));
        
        const splitTitle = data.title.split('/');
        const copiedData = JSON.parse(JSON.stringify(data));
        copiedData.dataPoints = mappedPoints;
        copiedData.titleLine1 = splitTitle[0];
        copiedData.titleLine2 = splitTitle[1];
        setHeroSectionObj(copiedData);
      })
      .catch((err) => {
        console.error("Failed to load blogs:", err);
      });

    fetch("/data/siteData.json")
      .then((res) => res.json())
      .then((data) => {
        const pageKey = `${page}-hero`;
        if (data.pages[pageKey] === "vertical" || data.pages[pageKey] === "vertical-reverse") setImageSize("w-1/2 h-auto");
        setPageLayout(data.pages[pageKey]);
        setSiteData(data);
      })
      .catch((err) => {
        console.error("Failed to load blogs:", err);
      });
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete) {
      setIsLoaded(true);
    }
  }, []);

  return (
    <section
      className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      <div className={localSectionMargin}>
        <div className="rounded-xl p-5 md:p-12" style={{ background: siteData?.surface }}>
          <div
            className={`
              grid items-center gap-12 
              ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "grid-cols-1" : "sm:grid-cols-2 md:grid-cols-2"}
            `}
          >
              <div className={`
                ${pageLayout === "horizontal-reverse" || pageLayout === "vertical-reverse" ? "order-2" : "order-1"}
                ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "mx-auto max-w-xl" : ""}
              `}>
                 <div className={`
                    space-y-6
                    ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "text-center" : ""}
                  `}>
                  <h1
                    id="hero-heading"
                    className={`${localTitleSize} font-display font-bold tracking-tight animate-fade-in`}
                    style={{ animationDelay: '200ms' }}
                  >
                    <span>{heroSectionObj?.titleLine1}</span>
                    <span className="block text-primary">{heroSectionObj?.titleLine2}</span>
                  </h1>
                  <p 
                    className={`${localSubtitleSize} text-gray-800 animate-fade-in`}
                    style={{ animationDelay: '300ms' }}
                  >
                  {heroSectionObj?.subtitle}
                  </p>
                  <div 
                    className="animate-fade-in"
                    style={{ animationDelay: '400ms' }}
                  >
                    <GetStartedButton buttonSize={heroSectionObj?.button.size} text={heroSectionObj?.button.text} page="Landing" color={heroSectionObj?.button?.color} />
                  </div>
                  <p 
                    className={`${localButtonSubText} text-gray-800 animate-fade-in`}
                    style={{ animationDelay: '500ms' }}
                  >
                    {heroSectionObj?.button.subtext}
                  </p>
                </div>
              </div>
              <div
                className={`
                  relative mx-20 sm:ml-2 md:mx-0
                  ${pageLayout === "horizontal-reverse" || pageLayout === "vertical-reverse" ? "order-1" : "order-2"}
                `}
              >
                <div
                  className={`
                    relative rounded-xl overflow-visible animate-fade-in
                    ${pageLayout === "vertical" || pageLayout === "vertical-reverse" ? "flex items-center justify-center" : ""}
                  `}
                  style={{ animationDelay: '600ms' }}
                >
                  <div className="transition-opacity duration-300">
                    <img
                      ref={imageRef}
                      src={heroSectionObj?.media}
                      alt="Animated dashboard showing content management across desktop, tablet, and phone"
                      className={`${imageSize} block mx-auto`}
                      onLoad={() => setIsLoaded(true)}
                    />
                  </div>
                </div>
              </div>
          </div>
        </div>
        <div className={`${localPointColumns} ${localPointsMarginTop} gap-8 grid`}>
          {heroSectionObj?.dataPoints?.map((point, index) => (
            <div
              key={index}
              className="rounded-xl transition-all text-center"
            >
              <point.icon size={28} className={`${localPointIconSize} mx-auto mb-4 ${point.className}`} />
              <h2 className={`${localPointTitleSize} font-semibold mb-2`}>{point.title}</h2>
              <p className={`${localPointDescSize} text-gray-800`}>
                {point.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
