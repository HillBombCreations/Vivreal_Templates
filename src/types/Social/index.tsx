export interface TikTokPost {
  id: string;
  caption: string;
  permalink: string | null;
  publishDate: string;
  status: string;
}

export interface TikTokOEmbed {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string;
}
