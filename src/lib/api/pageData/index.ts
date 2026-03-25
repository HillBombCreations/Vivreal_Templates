import 'server-only';
import type { PageConfig, PageCollectionBinding, PageIntegrationBinding } from '@/types/SiteData';
import type { ContentItem } from '@/types/ContentItem';
import { getCollectionItems, getIntegrationItems } from '../collections';
import { getPageBindingsByRole } from '../siteData';

interface RoleContent {
  items: ContentItem[];
  displayAs: string;
  label?: string;
  subtitle?: string;
}

export interface PageData {
  primary: RoleContent[];
  secondary: RoleContent[];
  supplemental: RoleContent[];
  sidebar: RoleContent[];
}

async function fetchBinding(
  binding: PageCollectionBinding | PageIntegrationBinding,
  type: 'collection' | 'integration'
): Promise<RoleContent> {
  if (type === 'collection') {
    const b = binding as PageCollectionBinding;
    const { items } = await getCollectionItems(b.collectionId);
    return { items, displayAs: b.displayAs ?? 'cards', label: b.name, subtitle: b.subtitle };
  }
  const b = binding as PageIntegrationBinding;
  const intType = b.type ?? b.name ?? '';
  const { items } = await getIntegrationItems(intType);
  return { items, displayAs: b.displayAs ?? 'feed', label: intType };
}

export async function getPageData(pageConfig: PageConfig): Promise<PageData> {
  const byRole = getPageBindingsByRole(pageConfig);
  const result: PageData = { primary: [], secondary: [], supplemental: [], sidebar: [] };

  for (const role of ['primary', 'secondary', 'supplemental', 'sidebar'] as const) {
    const { collections, integrations } = byRole[role];
    const promises = [
      ...collections.map((c) => fetchBinding(c, 'collection')),
      ...integrations.map((i) => fetchBinding(i, 'integration')),
    ];
    result[role] = await Promise.all(promises);
  }

  return result;
}
