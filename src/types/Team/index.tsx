export type TeamData = {
  name: string;
  description: string;
  id: string;
  image?: string;
  imageUrl?: string;
  
  objectValue: {
    headshot?: {
      key: string;
      currentFile: { source: string };
    };
    name: string;
    description: string;
    _id: string;
  };
};
