import "server-only";
import { clientFetchSafe } from "../client";
import { getSignedUrl } from "../media";
import type { LandingSections, ProductShowcaseItem, OfferingItem } from "@/types/Landing";

interface CollectionObjectsResponse {
  items: Record<string, unknown>[];
  totalCount: number;
}

function unwrapItems(raw: CollectionObjectsResponse | Record<string, unknown>[]): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw;
  return (raw as CollectionObjectsResponse)?.items ?? [];
}

function flattenObject(raw: Record<string, unknown>): Record<string, unknown> {
  const obj = (raw.objectValue ?? raw) as Record<string, unknown>;
  const imageUrl = getSignedUrl(obj.image) || (obj.imageUrl as string) || "";
  return { ...obj, imageUrl };
}

export async function getLandingSections(collectionId: string): Promise<LandingSections> {
  if (!collectionId) return {};
  const raw = await clientFetchSafe<CollectionObjectsResponse>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    { items: [], totalCount: 0 }
  );

  const items = unwrapItems(raw);
  const sections: LandingSections = {};
  for (const item of items) {
    const flat = flattenObject(item);
    const sectionName = (flat.sectionName as string) ?? (flat.name as string) ?? "";
    if (sectionName) {
      sections[sectionName] = flat as LandingSections[string];
    }
  }
  return sections;
}

export async function getProductShowcase(collectionId: string): Promise<ProductShowcaseItem[]> {
  if (!collectionId) return [];
  const raw = await clientFetchSafe<CollectionObjectsResponse>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    { items: [], totalCount: 0 }
  );
  return unwrapItems(raw).map((item) => flattenObject(item) as unknown as ProductShowcaseItem);
}

export async function getOfferings(collectionId: string): Promise<OfferingItem[]> {
  if (!collectionId) return [];
  const raw = await clientFetchSafe<CollectionObjectsResponse>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    { items: [], totalCount: 0 }
  );
  return unwrapItems(raw).map((item) => flattenObject(item) as unknown as OfferingItem);
}
