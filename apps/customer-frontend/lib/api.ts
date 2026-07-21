const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

export function resolveAssetUrl(url?: string | null) {
  if (!url || url.includes("cdn.example.com")) return undefined;
  return url.startsWith("/") ? `${API_ORIGIN}${url}` : url;
}

export async function getApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { next: { revalidate: 30 } });
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  const body = await response.json();
  return body.data as T;
}

export type StoreProduct = {
  id: string; name: string; slug: string; subtitle?: string; description?: string; basePrice: number | string;
  images?: { url: string; altText?: string }[];
  priceRange?: { minPrice: number; minSalePrice: number | null };
  variants?: { id: string; sku: string; identifier?: string | null; size?: string | null; width?: string | null; color?: string | null; colorCode?: string | null; stock: number; status: string; price: number | string; salePrice: number | string | null }[];
};

export type HomeData = {
  banners: { id: string; title: string; subtitle?: string; imageUrl: string; buttonText?: string; buttonLink?: string; collection?: { id: string; name: string; slug: string } | null }[];
  collections: { id: string; name: string; slug: string; description?: string | null; homepagePriority: number; products: { id: string; name: string; slug: string; basePrice: number | null; minPrice: number | null; imageUrl: string | null }[] }[];
};
