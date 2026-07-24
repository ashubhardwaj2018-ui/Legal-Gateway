import { useQuery } from "@tanstack/react-query";

export function usePageContent(page: string) {
  const { data } = useQuery<Record<string, string>>({
    queryKey: ["page-content", page],
    queryFn: async () => {
      const r = await fetch(`/api/pages/${page}`);
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 30_000,
    gcTime: 60_000,
  });

  return (blockId: string, fallback: string): string =>
    (data?.[blockId] != null && data[blockId] !== "") ? data[blockId] : fallback;
}
