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
  /** Responsive srcset of the headshot's resized variants (empty when no derivatives). */
  imageSrcSet?: string;
  socialLinks?: SocialLinks;
};

export type CMSTeamData = {
  _id: string;
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
