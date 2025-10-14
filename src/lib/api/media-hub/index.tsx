import { ArticleData, CMSArticleData } from "@/types/Articles"
import { cache } from "react";
import axios from 'axios';
import { articlesSectionData } from "@/data/mockData";
const API_URL = process.env.NEXT_PUBLIC_CLIENT_API;
const BLOGS_ID = process.env.NEXT_PUBLIC_BLOGS_ID;
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;
const BUCKET_NAME = process.env.NEXT_PUBLIC_BUCKET_NAME;

export const getArticles = async (): Promise<typeof articlesSectionData & { carouselData: ArticleData[] }> => {
  try {
    const { data } = await axios.get(`${API_URL}/tenant/collectionObjects`, {
        params: { collectionId: BLOGS_ID },
        headers: {
            Authorization: API_KEY,
            "Content-Type": "application/json",
        },
    });

    const carouselData: ArticleData[] = data.map((item: CMSArticleData) => (
      {
        title: item.objectValue.Title,
        body: item.objectValue.Body,
        date: item.objectValue.createdAt,
        description: item.objectValue.Description,
        image: item.objectValue.Image?.currentFile.source,
        imageUrl: item.objectValue.Image ? `https://${BUCKET_NAME}.s3.us-east-1.amazonaws.com/${item.objectValue.Image.key}` : undefined,
        slug: item.objectValue["Url Slug"],
        type: item.objectValue?.Type || "Article",
      }
    ));

    carouselData.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

    const tempSectionData = { ...articlesSectionData, carouselData };
    return tempSectionData;
  } catch (error) {
    console.error("Error fetching articles:", error);
    return { ...articlesSectionData, carouselData: [] };
  }
};

export const getArticleBySlug = cache(async(slug: string): Promise<ArticleData | null> => {
  const allArticles = (await getArticles()).carouselData;
  return allArticles.find(article => article.slug === `/articles/${slug}`) || null;
});