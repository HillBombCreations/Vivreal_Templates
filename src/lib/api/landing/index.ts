import "server-only";
import { clientFetchSafe } from "../client";
import { getSignedUrl } from "../media";
import type { LandingSections, ProductShowcaseItem, OfferingItem } from "@/types/Landing";

function flattenObject(raw: Record<string, unknown>): Record<string, unknown> {
  const obj = (raw.objectValue ?? raw) as Record<string, unknown>;
  const currentFile = obj.currentFile as Record<string, unknown> | undefined;
  const imageUrl = currentFile ? getSignedUrl(currentFile) : (obj.imageUrl as string) ?? "";
  return { ...obj, imageUrl };
}

export async function getLandingSections(collectionId: string): Promise<LandingSections> {
  if (!collectionId) return {};
  const raw = await clientFetchSafe<Record<string, unknown>[]>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    []
  );

  const sections: LandingSections = {};
  for (const item of raw) {
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
  const raw = await clientFetchSafe<Record<string, unknown>[]>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    []
  );
  return raw.map((item) => flattenObject(item) as unknown as ProductShowcaseItem);
}

export async function getOfferings(collectionId: string): Promise<OfferingItem[]> {
  if (!collectionId) return [];
  const raw = await clientFetchSafe<Record<string, unknown>[]>(
    `/tenant/collectionObjects?collectionId=${collectionId}`,
    []
  );
  return raw.map((item) => flattenObject(item) as unknown as OfferingItem);
}
