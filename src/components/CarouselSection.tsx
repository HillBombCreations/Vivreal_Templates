import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ArrowLeft, ArrowRight } from "lucide-react";

type CarouselObject = {
  title: string;
  imageSource: string;
  description: string;
  buttonLabel: string;
  rootSection: boolean;
  objectType: string;
  link: string;
};

type CarouselData = {
  title: string;
  subtitle: string;
  objects: CarouselObject[];
};

type SiteData = {
  pages: {
    [key: string]: "horizontal" | "horizontal-reverse" | "vertical" | "vertical-reverse" | string;
  };
  surface?: string;
  secondary?: string;
};

type CarouselSectionProps = {
  page: string;
};

export default function CarouselSection({ page }: CarouselSectionProps) {
  const navigate = useNavigate();
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [pageLayout, setPageLayout] = useState<string | null>(null);
  const [carouselData, setCarouselData] = useState<CarouselData | null>(null);

  useEffect(() => {
    fetch("/data/siteData.json")
      .then((res) => res.json())
      .then((data: SiteData) => {
        const pageKey = `${page}-carousel`;
        setPageLayout(data.pages[pageKey]);
        setSiteData(data);
      })
      .catch((err) => {
        console.error("Failed to load site data:", err);
      });

    fetch("/data/carouselData.json")
      .then((res) => res.json())
      .then((data: CarouselData) => {
        setCarouselData(data);
      })
      .catch((err) => {
        console.error("Failed to load carousel data:", err);
      });
  }, [page]);

  const isVertical = pageLayout === "vertical" || pageLayout === "vertical-reverse";
  const isReverse = pageLayout === "horizontal-reverse" || pageLayout === "vertical-reverse";

    const renderCarouselItem = (object: CarouselObject, index: number) => {
        return (
            <>
            <div
                className={`flex items-center justify-center ${
                isVertical ? "w-full mb-6 mr-20 ml-20" : !isReverse ? "md:w-2/5 mr-20 ml-5" : "md:w-2/5 ml-20 mr-5"
                }`}
            >
                <img
                src={object.imageSource}
                alt={object.title}
                className={`object-contain rounded-lg ${
                    isVertical ? "h-[250px] w-auto" : "w-full h-[250px]"
                }`}
                />
            </div>

            <div
                className={`flex flex-col justify-center ${
                isVertical ? "w-full mr-10" : !isReverse ? "md:w-3/5 mr-5" : "md:w-3/5 ml-5"
                }`}
            >
                <h3 className="text-3xl font-bold text-text-primary mb-4">{object.title}</h3>
                <p className="text-text-secondary text-base leading-relaxed mb-8">
                {object.description}
                </p>
                <button
                onClick={() =>
                    navigate(`/objects?filter=${encodeURIComponent(object.objectType)}`)
                }
                style={{ background: siteData?.surface }}
                className="text-inverse font-bold py-3 px-6 rounded-full inline-flex items-center gap-3 hover:bg-secondary transform hover:-translate-y-1 transition-all mx-auto md:mx-0"
                >
                {object.buttonLabel}
                <ArrowRight size={20} />
                </button>
            </div>
            </>
        );
    }
  return (
    <section className="w-full max-w-6xl mx-auto px-5 py-20">
      <div
        className={`${
          isVertical
            ? "flex flex-col items-center gap-12"
            : "flex flex-col md:flex-row md:justify-between gap-12"
        }`}
        style={{ minHeight: isVertical ? undefined : "40vh" }}
      >
        {/* Text Section */}
        <div
          className={`${
            isVertical ? "w-full max-w-xl text-center" : "md:w-2/5 flex flex-col justify-center"
          } ${isReverse ? "order-2" : "order-1"}`}
        >
          <h2 className="text-5xl font-extrabold text-text-primary mb-6">
            {carouselData?.title}
          </h2>
          <p className="text-xl text-text-secondary leading-relaxed">{carouselData?.subtitle}</p>
        </div>

        {/* Carousel Section */}
        <div
          className={`${
            isVertical ? "w-full max-w-4xl" : "md:w-3/5"
          } ${isReverse ? "order-1 mr-20" : "order-2"}`}
        >
          <Carousel opts={{ align: "start", loop: true }}>
            <CarouselContent
                className={`gap-6`}
            >
                {
                    carouselData?.objects.map((object, index) => (
                    <CarouselItem
                        key={`${object.title}-${index}`}
                        className="w-full md:basis-full py-10 flex justify-center"
                    >
                        {renderCarouselItem(object, index)}
                    </CarouselItem>
                    ))
                }
            </CarouselContent>

            {/* Controls */}
            <div className="flex justify-between mt-6">
              <CarouselPrevious
                style={{ background: siteData?.surface }}
                className="text-inverse rounded-full p-2 shadow-md hover:bg-secondary transition-transform hover:scale-110 focus:outline-none"
                aria-label="Previous object"
              >
                <ArrowLeft size={24} />
              </CarouselPrevious>
              <CarouselNext
                style={{ background: siteData?.surface }}
                className="text-inverse rounded-full p-2 shadow-md hover:bg-secondary transition-transform hover:scale-110 focus:outline-none"
                aria-label="Next object"
              >
                <ArrowRight size={24} />
              </CarouselNext>
            </div>
          </Carousel>
        </div>
      </div>
    </section>
  );
}