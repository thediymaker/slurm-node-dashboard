interface IndexedDocsPage {
  title: string;
  url: string;
  text: string;
}

interface CachedDocsIndex {
  timestamp: number;
  discoveredPages: number;
  pages: IndexedDocsPage[];
}

interface DocumentationSearchResult {
  title: string;
  url: string;
  snippet: string;
  score: number;
  matchedTerms: string[];
}

interface DocumentationSearchResponse {
  query: string;
  source: {
    documentationUrl: string;
    discoveredPages: number;
    indexedPages: number;
  };
  results: DocumentationSearchResult[];
}

const INDEX_CACHE = new Map<string, CachedDocsIndex>();
const INDEX_CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_DISCOVERED_URLS = 300;
const MAX_DISCOVERY_CRAWL_PAGES = 20;
const MAX_INDEX_PAGES = 180;
const MAX_SEARCH_RESULTS = 5;
const MAX_TEXT_CHARS = 250000;
const MAX_SITEMAP_CHARS = 1000000;
const BLOCKED_EXTENSIONS =
  /\.(?:7z|avi|css|csv|docx?|gif|gz|ico|jpeg|jpg|js|json|mov|mp4|pdf|png|pptx?|svg|tar|tgz|webp|xlsx?|xml|zip)$/i;
const STOP_WORDS = new Set([
  "a",
  "about",
  "above",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "ask",
  "at",
  "be",
  "by",
  "can",
  "cluster",
  "configured",
  "could",
  "detail",
  "details",
  "did",
  "do",
  "doc",
  "docs",
  "documentation",
  "does",
  "for",
  "from",
  "get",
  "give",
  "guide",
  "have",
  "help",
  "how",
  "i",
  "in",
  "info",
  "information",
  "into",
  "is",
  "it",
  "me",
  "need",
  "of",
  "on",
  "or",
  "page",
  "pages",
  "please",
  "policy",
  "research",
  "say",
  "says",
  "search",
  "should",
  "site",
  "supercomputer",
  "tell",
  "the",
  "their",
  "this",
  "to",
  "use",
  "using",
  "want",
  "what",
  "when",
  "where",
  "which",
  "with",
  "would",
  "you",
]);
const LOW_SIGNAL_TERMS = new Set([
  "command",
  "commands",
  "example",
  "examples",
  "hpc",
  "job",
  "jobs",
  "load",
  "module",
  "modules",
  "node",
  "nodes",
  "resource",
  "resources",
  "run",
  "running",
  "script",
  "scripts",
  "slurm",
]);

export async function searchDocumentation(
  documentationUrl: string,
  query: string
): Promise<DocumentationSearchResponse | { error: string }> {
  const normalizedQuery = normalizeWhitespace(query);
  if (!normalizedQuery) {
    return { error: "A documentation search query is required." };
  }

  const baseUrl = normalizeDocumentationUrl(documentationUrl);
  if (!baseUrl) {
    return {
      error:
        "Documentation search is not configured. Set a valid http(s) documentation URL in the LLM cluster settings.",
    };
  }

  const index = await getDocumentationIndex(baseUrl);
  if (index.pages.length === 0) {
    return {
      error: `No indexable documentation pages were found at ${baseUrl.href}.`,
    };
  }

  const results = rankPages(index.pages, normalizedQuery).slice(
    0,
    MAX_SEARCH_RESULTS
  );

  return {
    query: normalizedQuery,
    source: {
      documentationUrl: baseUrl.href,
      discoveredPages: index.discoveredPages,
      indexedPages: index.pages.length,
    },
    results,
  };
}

function normalizeDocumentationUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    url.hash = "";
    url.search = "";
    if (!url.pathname.endsWith("/")) {
      url.pathname = `${url.pathname}/`;
    }

    return url;
  } catch {
    return undefined;
  }
}

async function getDocumentationIndex(baseUrl: URL) {
  const cacheKey = baseUrl.href;
  const cached = INDEX_CACHE.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < INDEX_CACHE_TTL_MS) {
    return cached;
  }

  const urls = await discoverDocumentationUrls(baseUrl);
  const pages = await fetchIndexedPages(urls);
  const index = { timestamp: now, discoveredPages: urls.length, pages };
  INDEX_CACHE.set(cacheKey, index);

  return index;
}

async function discoverDocumentationUrls(baseUrl: URL) {
  const [homepageUrls, sitemapUrls] = await Promise.all([
    discoverFromHomepage(baseUrl),
    discoverFromSitemap(baseUrl),
  ]);

  return uniqueUrls([baseUrl.href, ...homepageUrls, ...sitemapUrls]).slice(
    0,
    MAX_DISCOVERED_URLS
  );
}

async function discoverFromSitemap(baseUrl: URL) {
  const sitemapCandidates = uniqueUrls([
    new URL("sitemap.xml", baseUrl).href,
    new URL("/sitemap.xml", baseUrl).href,
    new URL("sitemap_index.xml", baseUrl).href,
    new URL("/sitemap_index.xml", baseUrl).href,
  ]);
  const discovered: string[] = [];

  for (const sitemapUrl of sitemapCandidates) {
    const sitemap = await fetchText(sitemapUrl, MAX_SITEMAP_CHARS);
    if (!sitemap) continue;

    const locs = extractSitemapLocs(sitemap);
    const nestedSitemaps = locs
      .filter((url) => url.endsWith(".xml"))
      .slice(0, 4);
    const pageUrls = locs.filter((url) => isIndexableDocsUrl(url, baseUrl));

    discovered.push(...pageUrls);

    for (const nestedSitemapUrl of nestedSitemaps) {
      const nestedSitemap = await fetchText(
        nestedSitemapUrl,
        MAX_SITEMAP_CHARS
      );
      if (!nestedSitemap) continue;
      discovered.push(
        ...extractSitemapLocs(nestedSitemap).filter((url) =>
          isIndexableDocsUrl(url, baseUrl)
        )
      );
    }

    if (discovered.length >= MAX_DISCOVERED_URLS) break;
  }

  return uniqueUrls(discovered).slice(0, MAX_DISCOVERED_URLS);
}

async function discoverFromHomepage(baseUrl: URL) {
  const discovered = new Set<string>([baseUrl.href]);
  const queued = new Set<string>([baseUrl.href]);
  const queue = [baseUrl.href];
  let crawledPages = 0;

  while (
    queue.length > 0 &&
    crawledPages < MAX_DISCOVERY_CRAWL_PAGES &&
    discovered.size < MAX_DISCOVERED_URLS
  ) {
    const currentUrl = queue.shift();
    if (!currentUrl) break;

    crawledPages += 1;
    const html = await fetchText(currentUrl, MAX_TEXT_CHARS);
    if (!html) continue;

    for (const link of extractLinks(html, new URL(currentUrl))) {
      if (!isIndexableDocsUrl(link, baseUrl)) continue;
      if (discovered.size >= MAX_DISCOVERED_URLS) break;

      discovered.add(link);

      if (!queued.has(link) && shouldCrawlForMoreLinks(link, baseUrl)) {
        queued.add(link);
        queue.push(link);
      }
    }
  }

  return Array.from(discovered);
}

async function fetchIndexedPages(urls: string[]) {
  const pages: IndexedDocsPage[] = [];
  const uniquePageUrls = uniqueUrls(urls).slice(0, MAX_INDEX_PAGES);
  const batchSize = 6;

  for (let index = 0; index < uniquePageUrls.length; index += batchSize) {
    const batch = uniquePageUrls.slice(index, index + batchSize);
    const batchPages = await Promise.all(
      batch.map(async (url) => {
        const html = await fetchText(url, MAX_TEXT_CHARS);
        return html ? extractPage(url, html) : undefined;
      })
    );

    pages.push(
      ...batchPages.filter(
        (page): page is IndexedDocsPage => Boolean(page?.text)
      )
    );
  }

  return pages;
}

async function fetchText(url: string, maxChars: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "slurm-node-dashboard-docs-search/1.0",
      },
      signal: controller.signal,
    });

    if (!response.ok) return undefined;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxChars) {
      return undefined;
    }

    const text = await response.text();
    return text.slice(0, maxChars);
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function extractSitemapLocs(xml: string) {
  const locs: string[] = [];
  const locRegex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    locs.push(decodeHtmlEntities(match[1].trim()));
  }

  return locs;
}

function extractLinks(html: string, baseUrl: URL) {
  const links: string[] = [];
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(decodeHtmlEntities(match[1]), baseUrl);
      url.hash = "";
      url.search = "";
      links.push(url.href);
    } catch {
      // Ignore invalid links.
    }
  }

  return uniqueUrls(links);
}

function extractPage(url: string, html: string): IndexedDocsPage {
  const title =
    extractFirstTagText(html, "h1") ||
    extractFirstTagText(html, "title") ||
    url;
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  const text = normalizeWhitespace(htmlToText(main));

  return {
    title: normalizeWhitespace(title),
    url,
    text,
  };
}

function extractFirstTagText(html: string, tagName: string) {
  const match = html.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i")
  );
  return match ? normalizeWhitespace(htmlToText(match[1])) : "";
}

function htmlToText(html: string) {
  return decodeHtmlEntities(
    stripNonContentHtml(html)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

function stripNonContentHtml(html: string) {
  return html
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, " ")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")
    .replace(/<button\b[\s\S]*?<\/button>/gi, " ");
}

interface QueryProfile {
  query: string;
  terms: string[];
  strongTerms: string[];
  variantsByTerm: Map<string, string[]>;
}

function rankPages(pages: IndexedDocsPage[], query: string) {
  const profile = buildQueryProfile(query);
  if (profile.terms.length === 0) return [];

  const documentFrequency = getDocumentFrequency(pages, profile);
  const rankedResults = pages
    .map((page) => {
      const lowerTitle = page.title.toLowerCase();
      const lowerUrl = page.url.toLowerCase();
      const lowerText = page.text.toLowerCase();
      const matchedTerms: string[] = [];
      let strongTermHits = 0;
      let score = lowerText.includes(profile.query) ? 50 : 0;

      for (const term of profile.terms) {
        const variants = profile.variantsByTerm.get(term) || [term];
        const titleHits = countVariantOccurrences(lowerTitle, variants);
        const urlHits = countVariantOccurrences(lowerUrl, variants);
        const textHits = countVariantOccurrences(lowerText, variants);
        const totalHits = titleHits + urlHits + textHits;

        if (totalHits === 0) continue;

        matchedTerms.push(term);
        if (profile.strongTerms.includes(term)) {
          strongTermHits += 1;
        }

        const idf = Math.log(
          1 + (pages.length + 1) / (1 + (documentFrequency.get(term) || 0))
        );
        score += idf * (titleHits * 16 + urlHits * 10 + Math.min(textHits, 12) * 2);
      }

      const coverage = matchedTerms.length / profile.terms.length;
      score += coverage * 12;

      if (profile.strongTerms.length > 0) {
        score += (strongTermHits / profile.strongTerms.length) * 18;
      }

      return {
        title: page.title,
        url: page.url,
        snippet: getSnippet(page.text, profile),
        score,
        matchedTerms,
        strongTermHits,
      };
    })
    .filter((result) => result.score > 0);

  const hasStrongMatches =
    profile.strongTerms.length > 0 &&
    rankedResults.some((result) => result.strongTermHits > 0);
  const bestStrongTermHits = Math.max(
    0,
    ...rankedResults.map((result) => result.strongTermHits)
  );
  const minimumStrongTermHits =
    profile.strongTerms.length > 1 &&
    bestStrongTermHits === profile.strongTerms.length
      ? profile.strongTerms.length
      : 1;

  return rankedResults
    .filter(
      (result) =>
        !hasStrongMatches || result.strongTermHits >= minimumStrongTermHits
    )
    .sort((left, right) => right.score - left.score)
    .map(({ strongTermHits: _strongTermHits, ...result }) => result);
}

function getSnippet(text: string, profile: QueryProfile) {
  const lowerText = text.toLowerCase();
  let position = lowerText.indexOf(profile.query);

  if (position < 0) {
    const candidateTerms = uniqueStrings([
      ...profile.strongTerms,
      ...profile.terms,
    ]);

    for (const term of candidateTerms) {
      const variants = profile.variantsByTerm.get(term) || [term];
      position = findFirstVariantPosition(lowerText, variants);
      if (position >= 0) break;
    }
  }

  if (position === undefined || position < 0) {
    return text.slice(0, 360);
  }

  const start = Math.max(0, position - 140);
  const end = Math.min(text.length, position + 260);
  const prefix = start > 0 ? "... " : "";
  const suffix = end < text.length ? " ..." : "";

  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function buildQueryProfile(query: string): QueryProfile {
  const terms = tokenize(query);
  const strongTerms = terms.filter((term) => !LOW_SIGNAL_TERMS.has(term));
  const variantsByTerm = new Map(
    terms.map((term) => [term, getTermVariants(term)])
  );

  return {
    query: query.toLowerCase(),
    terms,
    strongTerms,
    variantsByTerm,
  };
}

function getDocumentFrequency(pages: IndexedDocsPage[], profile: QueryProfile) {
  const frequency = new Map<string, number>();

  for (const term of profile.terms) {
    const variants = profile.variantsByTerm.get(term) || [term];
    frequency.set(
      term,
      pages.filter((page) =>
        containsAnyVariant(
          `${page.title} ${page.url} ${page.text}`.toLowerCase(),
          variants
        )
      ).length
    );
  }

  return frequency;
}

function tokenize(value: string) {
  const rawTerms = normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9_-]+/i)
    .filter((term) => term.length > 1);
  const usefulTerms = rawTerms.filter((term) => !STOP_WORDS.has(term));

  return uniqueStrings(usefulTerms.length > 0 ? usefulTerms : rawTerms);
}

function getTermVariants(term: string) {
  const variants = new Set([term]);

  if (term.endsWith("ies") && term.length > 4) {
    variants.add(`${term.slice(0, -3)}y`);
  } else if (term.endsWith("es") && term.length > 4) {
    variants.add(term.slice(0, -2));
  } else if (term.endsWith("s") && term.length > 3) {
    variants.add(term.slice(0, -1));
  }

  return Array.from(variants);
}

function containsAnyVariant(value: string, variants: string[]) {
  return variants.some((variant) => value.includes(variant));
}

function countVariantOccurrences(value: string, variants: string[]) {
  return Math.max(...variants.map((variant) => countOccurrences(value, variant)));
}

function findFirstVariantPosition(value: string, variants: string[]) {
  const positions = variants
    .map((variant) => value.indexOf(variant))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right);

  return positions[0] ?? -1;
}

function countOccurrences(value: string, term: string) {
  if (!term) return 0;
  let count = 0;
  let position = value.indexOf(term);

  while (position >= 0) {
    count += 1;
    position = value.indexOf(term, position + term.length);
  }

  return count;
}

function isIndexableDocsUrl(value: string, baseUrl: URL) {
  try {
    const url = new URL(value);
    url.hash = "";

    return (
      url.origin === baseUrl.origin &&
      url.pathname.startsWith(baseUrl.pathname) &&
      !BLOCKED_EXTENSIONS.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function shouldCrawlForMoreLinks(value: string, baseUrl: URL) {
  try {
    const url = new URL(value);
    const relativePath = url.pathname
      .slice(baseUrl.pathname.length)
      .replace(/^\/+|\/+$/g, "");

    if (!relativePath) return true;
    return relativePath.split("/").length <= 1;
  } catch {
    return false;
  }
}

function uniqueUrls(urls: string[]) {
  return Array.from(new Set(urls));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}
