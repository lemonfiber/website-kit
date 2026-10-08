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
/** The route a collection entry is served at: `index` is the root. */
export const routeOfEntry = (id) => id === "index" ? "/" : `/${id}/`;
/**
 * The address a `package.json` names its repository at, without the scheme
 * prefix npm accepts and the `.git` suffix a clone URL carries, or null where it
 * names none.
 */
export function repositoryOf(manifest) {
    let parsed;
    try {
        parsed = JSON.parse(manifest);
    }
    catch {
        return null;
    }
    const repository = parsed?.repository;
    const url = typeof repository === "string"
        ? repository
        : repository?.url;
    if (typeof url !== "string" || url === "")
        return null;
    return url.replace(/^git\+/, "").replace(/\.git$/, "");
}
/** Every route the collection renders, in route order, and where it came from. */
export function provenanceIndex(entries, own) {
    const index = entries.map((entry) => {
        const mirror = entry.data.mirror;
        const origin = mirror === undefined
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
