export type ReviewData = {
  email: string;
  name: string;
  review: string;
  rating: number;
  collectionId: string;
  // Honeypot — must stay empty for real humans. The renderer form ships it as
  // an empty hidden field; bots that fill it are silently rejected server-side.
  company_website?: string;
};

export type ReviewDisplay = {
  id: string;
  name: string;
  review: string;
  rating: number;
  date: string;
};