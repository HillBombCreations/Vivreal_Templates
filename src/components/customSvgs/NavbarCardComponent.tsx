import { FeaturesIllustration } from "@/components/customSvgs/FeaturesIllustration";
import { Solutionsllustration } from "@/components/customSvgs/Solutionsllustration";
import { DevelopersIllustration } from "@/components/customSvgs/DevelopersIllustration";
import { CardComponent } from '@/types/Navigation';

export const NavbarCardComponent: Record<string, CardComponent> = {
  features: {
    title: "Features",
    subtitle: "Discover the tools and capabilities that make managing your content seamless.",
    link: "/features",
    buttonText: "Explore Features",
    image: FeaturesIllustration,
  },
  solutions: {
    title: "Solutions",
    link: "/solutions",
    subtitle: "See how our platform solves real-world challenges across industries and use cases.",
    buttonText: "Explore Solutions",
    image: Solutionsllustration,
  },
  developers: {
    title: "Developers",
    link: "/developers",
    subtitle: "Explore dev tools, product updates, and ideas shaping the platform.",
    buttonText: "Explore Developers",
    image: DevelopersIllustration,
  }
};
