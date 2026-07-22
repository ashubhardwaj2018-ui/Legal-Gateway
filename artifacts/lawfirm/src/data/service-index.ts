import { SERVICES_DATA } from "./services";
import { toSlug } from "@/lib/slug";

export interface ServiceInfo {
  name: string;
  slug: string;
  categoryId: string;
  categoryTitle: string;
  description: string;
  price: string;
}

const _index: Record<string, ServiceInfo> = {};

for (const [catId, cat] of Object.entries(SERVICES_DATA)) {
  for (const service of cat.services) {
    const slug = toSlug(service.name);
    if (!_index[slug]) {
      _index[slug] = {
        name: service.name,
        slug,
        categoryId: catId,
        categoryTitle: cat.title,
        description: service.description,
        price: service.price,
      };
    }
  }
}

export const SERVICE_INDEX = _index;
export const ALL_SERVICES: ServiceInfo[] = Object.values(_index);

export function getServiceBySlug(slug: string): ServiceInfo | undefined {
  return _index[slug];
}

export function getServicesByCategory(catId: string): ServiceInfo[] {
  return ALL_SERVICES.filter((s) => s.categoryId === catId);
}
