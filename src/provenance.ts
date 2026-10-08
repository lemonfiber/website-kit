/**
 * Where every route a site renders came from: the repository, the path in it,
 * and the revision (REPO-R83).
 *
 * A mirrored page says so in the provenance the mirror loader stamped on it. A
 * page the site wrote itself came from the site's own repository, at the
 * revision the build ran from. The index is what a tool asks to turn an address
 * a reader is looking at into the file to change.
 *
 * Pure functions over the collection's entries. The site's endpoint reads the
 * collection and its own revision.
 */

import type { Provenance } from "./mirror-loader.ts";

/** Where one route came from. */
export interface Origin {
  /** The owning repository, as its address on the forge. */
  readonly repository: string;
  readonly path: string;
  readonly revision: string;
}

/** One entry of a site's content collection, as much of it as this reads. */
export interface Rendered {
  readonly id: string;
  readonly filePath?: string | undefined;
  readonly data: { readonly mirror?: Provenance | undefined };
}

/** The site's own repository and the revision a build ran from. */
export interface Own {
  readonly repository: string;
  readonly revision: string;
}

/** The route a collection entry is served at: `index` is the root. */
export const routeOfEntry = (id: string): string =>
  id === "index" ? "/" : `/${id}/`;

/**
 * The address a `package.json` names its repository at, without the scheme
 * prefix npm accepts and the `.git` suffix a clone URL carries, or null where it
 * names none.
 */
export function repositoryOf(manifest: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(manifest);
  } catch {
    return null;
  }
  const repository = (parsed as { repository?: unknown } | null)?.repository;
  const url =
    typeof repository === "string"
      ? repository
      : (repository as { url?: unknown } | undefined)?.url;
  if (typeof url !== "string" || url === "") return null;
  return url.replace(/^git\+/, "").replace(/\.git$/, "");
}

/** Every route the collection renders, in route order, and where it came from. */
export function provenanceIndex(
  entries: readonly Rendered[],
  own: Own,
): Record<string, Origin> {
  const index = entries.map((entry): [string, Origin] => {
    const mirror = entry.data.mirror;
    const origin: Origin =
      mirror === undefined
        ? {
            repository: own.repository,
            path: entry.filePath ?? "",
            revision: own.revision,
          }
        : {
            repository: mirror.remote,
            path: mirror.path,
            revision: mirror.revision,
          };
    return [routeOfEntry(entry.id), origin];
  });
  return Object.fromEntries(index.sort(([a], [b]) => (a < b ? -1 : 1)));
}
