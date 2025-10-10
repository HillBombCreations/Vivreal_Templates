import { NavigationData } from "@/types/Navigation";
import { 
  navigationLinks,
} from "@/data/mockData";


export const getHeroSectionData = async (): Promise<NavigationData[]> => {
  return navigationLinks;
};