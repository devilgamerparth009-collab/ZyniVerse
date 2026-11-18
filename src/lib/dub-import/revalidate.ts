/**
 * Post-sync cache invalidation for the dub hub.
 *
 * The public dub routes read Prisma directly (no `fetch` tags), so the Next.js
 * 16 API for them is `revalidatePath`, not `revalidateTag`. It is called from
 * Route Handlers only. CDN caches still honour their own `s-maxage`; the short
 * schedule TTL is set on the schedule route response itself.
 *
 * Every path is invalidated independently: a failure for one path must never
 * fail the sync or skip the remaining paths.
 */
import { revalidatePath } from "next/cache";

export const DUB_REVALIDATE_PATHS = [
  "/api/dub/overview",
  "/api/dub/schedule",
  "/api/dub-schedule",
  "/api/dub/catalog",
  "/api/dub/sources",
  "/hindi-dub",
  "/dubbed",
] as const;

export interface RevalidationReport {
  attempted: string[];
  failed: string[];
}

export function revalidateDubCaches(
  paths: readonly string[] = DUB_REVALIDATE_PATHS
): RevalidationReport {
  const failed: string[] = [];
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      failed.push(path);
    }
  }
  return { attempted: [...paths], failed };
}
