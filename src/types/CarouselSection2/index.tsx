export type BlogType = {
  title: string;
  description: string;
  date?: string;
  slug: string;
  body: string;
  image?: string;
};

export type CarouselSection2Type = {
  title?: string;
  linkText?: string;
  linkSlug?: string;
  mobileLabel?: string;
  loadingMessage?: string;
  noDataMessage?: string;
  carouselData?: BlogType[];
};