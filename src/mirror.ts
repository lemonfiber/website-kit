/**
 * The rules for rendering a tree this repository does not own.
 *
 * Everything here is a pure function over text and paths. Reading the tree and
 * asking git what revision it holds is `mirror-source.ts`; wiring the two into
 * a content collection is `mirror-loader.ts`.
 */

/** A tree or a file under `src/content/docs` that another repository owns. */
export interface Mirror {
  /** Route below `src/content/docs`. A `.md` suffix means a single file. */
  readonly route: string;
  /** Directory under `vendor/`. */
  readonly repo: string;
  /** Path within that directory; empty for its root. */
  readonly path: string;
  /** The repository's web home, without a trailing slash. */
  readonly remote: string;
  /** The default branch the edit link points at. */
  readonly branch: string;
  /** How the site names the repository on a rendered page. */
  readonly label: string;
  /** Top-level names to render; everything else in the tree is ignored. */
  readonly include?: readonly string[];
  /** The file that serves a directory's own route. Defaults to `README`. */
  readonly index?: string;
  /** Title for a page whose source carries no heading to take one from. */
  readonly title?: string;
  /** Titles by path, for tree mirrors whose sources carry no heading. */
  readonly titles?: Readonly<Record<string, string>>;
  /** Where the section sits in the sidebar. */
  readonly order?: number;
}

/** The upstream revision a mirrored page was rendered from. */
export interface Revision {
  readonly sha: string;
  readonly date: string;
}

/** One page, ready for the content store. */
export interface MirroredPage {
  /** The collection id, which is also the route. */
  readonly id: string;
  readonly title: string;
  readonly body: string;
  /** Path within the repository, for the edit link and the provenance stamp. */
  readonly upstream: string;
  readonly repo: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const SCALAR = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]+(\S.*)$/;
const HEADING = /^#[ \t]+(\S.*)$/m;
const MARKUP = /[`*_]/g;
/** A markdown link. Its text and its destination each stop at a bracket. */
const LINK = /(!?\[[^[\]]*\]\()([^[)]*)(\))/g;
const ABSOLUTE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;
const TAG = /<[a-zA-Z][^>]*>/g;
const ATTRIBUTE = /(\s)(src|href|srcset)="([^"]*)(")/g;

/** A capture group's text. A group that did not participate contributed none. */
export function captured(match: RegExpExecArray, index: number): string {
  const value: string | undefined = match[index];
  return value ?? "";
}

/** The first segment of a path. */
export function head(path: string): string {
  const at = path.indexOf("/");
  return at === -1 ? path : path.slice(0, at);
}

/** A link's target and whatever follows it, which is the optional title. */
export function untitled(inside: string): [string, string] {
  const at = inside.search(/\s/);
  if (at === -1) return [inside, ""];
  return [inside.slice(0, at), inside.slice(at)];
}

/** A fragment as it is written back into a link, or nothing. */
function anchorOf(fragment: string | undefined): string {
  return fragment === undefined ? "" : `#${fragment}`;
}

/** A link target split into its path and its fragment. */
function split(target: string): [string, string | undefined] {
  const at = target.indexOf("#");
  if (at === -1) return [target, undefined];
  return [target.slice(0, at), target.slice(at + 1)];
}

/** A file mirror renders one page; a tree mirror renders every page under it. */
export function isFile(mirror: Mirror): boolean {
  return mirror.route.endsWith(".md");
}

/** The source text with any YAML frontmatter block removed. */
export function withoutFrontmatter(source: string): string {
  return source.replace(FRONTMATTER, "");
}

/**
 * The single-line keys of a YAML frontmatter block, as text. A key whose value
 * is on following lines has none here; only `title` is read from this.
 */
export function frontmatter(source: string): Record<string, string> {
  const block = FRONTMATTER.exec(source);
  const found: Record<string, string> = {};
  if (block === null) return found;
  for (const line of captured(block, 1).split(/\r?\n/)) {
    const pair = SCALAR.exec(line);
    if (pair !== null)
      found[captured(pair, 1)] = captured(pair, 2)
        .trim()
        .replace(/^["']|["']$/g, "");
  }
  return found;
}

/**
 * What the page is called: the frontmatter `title`, else the first heading,
 * else what the mirror declared. A page with none of the three is a fault.
 */
export function titleOf(source: string, declared?: string): string | null {
  const stated = frontmatter(source)["title"];
  if (stated !== undefined && stated !== "") return stated;
  const heading = HEADING.exec(withoutFrontmatter(source));
  if (heading !== null)
    return captured(heading, 1).replace(MARKUP, "").trimEnd();
  return declared ?? null;
}

/** The body with its first heading removed; the page renders one of its own. */
export function withoutLeadingHeading(source: string): string {
  const body = withoutFrontmatter(source);
  const heading = HEADING.exec(body);
  if (heading === null) return body.trimStart();
  return body.slice(heading.index + captured(heading, 0).length).trimStart();
}

/** `a/b/../c` collapsed to `a/c`. A path may not climb above its own root. */
export function resolvePath(from: string, target: string): string | null {
  const stack = from === "" ? [] : from.split("/");
  for (const part of target.split("/")) {
    if (part === "" || part === ".") continue;
    if (part !== "..") {
      stack.push(part);
      continue;
    }
    if (stack.length === 0) return null;
    stack.pop();
  }
  return stack.join("/");
}

/**
 * The route a source file serves under its mirror. A `README` is the index of
 * the directory holding it, which is what makes a section landing page. Routes
 * are lower case: a file name's capitalisation is a repository's business, not
 * a reader's.
 */
export function routeOf(mirror: Mirror, relative: string): string {
  if (isFile(mirror)) return mirror.route.replace(/\.md$/, "").toLowerCase();
  const index = new RegExp(`(^|/)${mirror.index ?? "README"}$`);
  const trimmed = relative.replace(/\.md$/, "").replace(index, "");
  return [mirror.route, trimmed]
    .filter((part) => part !== "")
    .join("/")
    .toLowerCase();
}

/**
 * The path a mirrored page's markdown is attributed to while it renders.
 *
 * Nothing reads the file — the bytes are already in hand — but a renderer that
 * is told where a page lives can name it in a report, and the link checker
 * only checks a page it can name.
 */
export function attributedPath(id: string): string {
  return `src/content/docs/${id === "" ? "index" : id}.md`;
}

/** Whether a path is rendered at all, given the mirror's `include` list. */
export function isIncluded(mirror: Mirror, relative: string): boolean {
  if (!relative.endsWith(".md")) return false;
  if (mirror.include === undefined) return true;
  return (
    mirror.include.includes(head(relative)) || mirror.include.includes(relative)
  );
}

/** The address the pinned bytes have upstream: `raw` renders, `blob` reads. */
const upstream = (
  mirror: Mirror,
  revision: Revision,
  path: string,
  kind: "raw" | "blob",
): string => `${mirror.remote}/${kind}/${revision.sha}/${path}`;

const join = (...parts: string[]): string =>
  parts.filter((part) => part !== "").join("/");

/**
 * The body in runs, saying of each whether it is an example.
 *
 * A fenced block is what a reader copies. A link inside one is being *shown*,
 * not offered — rewriting it hands them a hundred-character absolute URL where
 * the example said `../AGENTS.md`, and what they copy no longer demonstrates
 * what it was written to demonstrate.
 *
 * An unclosed fence takes the rest of the document with it, which is what a
 * renderer does with one too.
 */
export function runs(
  body: string,
): { readonly code: boolean; readonly text: string }[] {
  const out: { code: boolean; text: string }[] = [];
  let held: string[] = [];
  let fence: string | null = null;

  // Only a run that holds lines is emitted. An empty one would join back with a
  // separator the body never had, and putting the document back together
  // unchanged is the whole contract here.
  const flush = (code: boolean): void => {
    if (held.length > 0) out.push({ code, text: held.join("\n") });
    held = [];
  };

  for (const line of body.split("\n")) {
    const marker = /^[ \t]*(`{3,}|~{3,})/.exec(line)?.[1]?.[0] ?? null;

    if (fence === null && marker !== null) {
      flush(false);
      held = [line];
      fence = marker;
      continue;
    }
    if (fence !== null && marker === fence) {
      held.push(line);
      flush(true);
      fence = null;
      continue;
    }
    held.push(line);
  }

  flush(fence !== null);
  return out;
}

/**
 * Rewrite the links of a mirrored page.
 *
 * A relative link to another mirrored page becomes that page's route, whether
 * that page comes from this mirror or from another one. Anything else relative
 * — an image, a manifest, a file nothing renders — becomes a link to the
 * repository that owns it, at the revision the page was rendered from, so it
 * resolves to those bytes rather than to a 404 here.
 */
export function rewriteLinks(
  body: string,
  mirror: Mirror,
  revision: Revision,
  relative: string,
  routes: ReadonlyMap<string, string>,
  cross: ReadonlyMap<string, string> = new Map(),
): string {
  const within = relative.split("/").slice(0, -1).join("/");
  // The directory the page sits in *within its repository*, which is what a link
  // leaving the site resolves against. Taken from the whole path rather than by
  // joining the mirror's own, because a mirror of a single file has no `relative`
  // at all — its `path` *is* the file — and treating that as a directory sent
  // every outward link through it: `README.md/AGENTS.md`.
  const inRepo = join(mirror.path, relative).split("/").slice(0, -1).join("/");
  const repoPath = (path: string): string =>
    resolvePath(inRepo, path) ?? join(mirror.path, path);

  const away = (target: string, kind: "raw" | "blob"): string => {
    const [path] = split(target);
    return upstream(mirror, revision, repoPath(path), kind);
  };

  const here = (target: string): string | null => {
    const [path, fragment] = split(target);
    const anchor = anchorOf(fragment);
    const mine = resolvePath(within, path);
    const local =
      mine === null
        ? undefined
        : (routes.get(mine) ?? routes.get(join(mine, "README.md")));
    if (local !== undefined) return `/${local}/${anchor}`;
    const key = `${mirror.remote}|${repoPath(path)}`;
    const other = cross.get(key) ?? cross.get(`${key}/README.md`);
    return other === undefined ? null : `/${other}/${anchor}`;
  };

  /** Where a target points once rewritten; `routed` allows a page of this site. */
  const moved = (
    target: string,
    kind: "raw" | "blob",
    routed = true,
  ): string | null => {
    if (ABSOLUTE.test(target)) return crossRoute(target, cross);
    return (routed ? here(target) : null) ?? away(target, kind);
  };

  const prose = (text: string): string => {
    const markdown = text.replace(
      LINK,
      (whole, open: string, inside: string, close: string) => {
        const [target, title] = untitled(inside);
        if (target === "") return whole;
        const resolved = moved(target, open.startsWith("!") ? "raw" : "blob");
        if (resolved === null) return whole;
        return `${open}${resolved}${title}${close}`;
      },
    );

    return markdown.replace(TAG, (tag) =>
      tag.replace(
        ATTRIBUTE,
        (whole, open: string, name: string, target: string, close: string) => {
          const link = name === "href";
          const resolved = moved(target, link ? "blob" : "raw", link);
          if (resolved === null) return whole;
          return `${open}${name}="${resolved}${close}`;
        },
      ),
    );
  };

  // An example is shown, not offered.
  return runs(body)
    .map((run) => (run.code ? run.text : prose(run.text)))
    .join("\n");
}

const UPSTREAM =
  /^(https?:\/\/[^/]+\/[^/]+\/[^/]+)\/(?:blob|tree)\/[^/]+\/(.+)$/;

/**
 * The route this site serves for a link written as an upstream file URL.
 *
 * One repository's prose points at another's files by their address on the
 * forge. Where this site already renders that file, the reader stays here.
 */
export function crossRoute(
  url: string,
  cross: ReadonlyMap<string, string>,
): string | null {
  const match = UPSTREAM.exec(url);
  if (match === null) return null;
  const remote = captured(match, 1);
  const [path, fragment] = split(captured(match, 2));
  const key = `${remote}|${path.replace(/\/$/, "")}`;
  const route = cross.get(key) ?? cross.get(`${key}/README.md`);
  if (route === undefined) return null;
  return `/${route}/${anchorOf(fragment)}`;
}

/** Where a reader edits the page: the file itself, on the default branch. */
export function editUrl(mirror: Mirror, relative: string): string {
  const path = isFile(mirror) ? mirror.path : join(mirror.path, relative);
  return `${mirror.remote}/edit/${mirror.branch}/${path}`;
}

/** Where a reader sees exactly the bytes that were rendered. */
export function sourceUrl(
  mirror: Mirror,
  revision: Revision,
  relative: string,
): string {
  const path = isFile(mirror) ? mirror.path : join(mirror.path, relative);
  return `${mirror.remote}/blob/${revision.sha}/${path}`;
}

/** `2026-08-23T04:20:11+02:00` as `2026-08-23`. */
export function dayOf(iso: string): string {
  const at = iso.indexOf("T");
  return at === -1 ? iso.trim() : iso.slice(0, at).trim();
}

/** The seven leading characters git itself would show. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/** What `git log -1 --format=%H%n%cI` said. */
export function parseRevision(output: string): Revision {
  const text = output.trim();
  const at = text.indexOf("\n");
  if (at === -1) return { sha: text, date: "" };
  return { sha: text.slice(0, at), date: text.slice(at + 1).trim() };
}

/** Every mirrored path, mapped to the route that renders it. */
export function routeTable(
  mirror: Mirror,
  relatives: readonly string[],
): Map<string, string> {
  const table = new Map<string, string>();
  for (const relative of relatives)
    table.set(relative, routeOf(mirror, relative));
  return table;
}

/** The same table, keyed by the address the file has on its own forge. */
export function crossTable(
  mirror: Mirror,
  relatives: readonly string[],
): Map<string, string> {
  const table = new Map<string, string>();
  for (const relative of relatives)
    table.set(
      `${mirror.remote}|${join(mirror.path, relative)}`,
      routeOf(mirror, relative),
    );
  return table;
}
