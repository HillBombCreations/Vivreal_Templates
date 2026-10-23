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
  /** The record's own last change, ISO (discovery batch 3.3, the sitemap date). */
  updatedAt?: string;
  image?: string;
  imageUrl?: string;
  /** Responsive srcset of the headshot's resized variants (empty when no derivatives). */
  imageSrcSet?: string;
  socialLinks?: SocialLinks;
};

export type CMSTeamData = {
  _id: string;
  updatedAt?: string;
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
