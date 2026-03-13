export type SocialLinks = {
  tiktok?: string;
  instagram?: string;
  linkedin?: string;
  x?: string;
  facebook?: string;
};

export type TeamData = {
  name: string;
  description: string;
  id: string;
  image?: string;
  imageUrl?: string;
  socialLinks?: SocialLinks;
};

export type CMSTeamData = {
  objectValue: {
    headshot?: {
      key: string;
      currentFile: { source: string };
    };
    name: string;
    description: string;
    _id: string;
    socialLinks?: SocialLinks;
  };
};
