import { Router, type IRouter } from "express";

type NewsCategory = "markets" | "forex" | "stocks" | "commodities" | "crypto";

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
};

type Feed = {
  source: string;
  url: string;
};

const FEEDS: Feed[] = [
  { source: "CNBC Markets", url: "https://www.cnbc.com/id/100003114/device/rss/rss.html" },
  { source: "MarketWatch", url: "https://feeds.marketwatch.com/marketwatch/topstories/" },
  { source: "Yahoo Finance", url: "https://finance.yahoo.com/news/rssindex" },
];

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedArticles: NewsArticle[] = [];
let cachedAt = 0;

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function readTag(item: string, tag: string): string {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function readAttribute(item: string, tag: string, attribute: string): string {
  const match = item.match(new RegExp(`<${tag}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? "";
}

function classifyArticle(title: string, summary: string): NewsCategory {
  const text = `${title} ${summary}`.toLowerCase();
  if (/\b(bitcoin|ethereum|crypto|blockchain|digital asset|altcoin)\b/.test(text)) return "crypto";
  if (/\b(gold|silver|oil|crude|brent|copper|commodity|commodities)\b/.test(text)) return "commodities";
  if (/\b(forex|currency|dollar|euro|yen|pound|sterling|fed|ecb|boj|central bank|interest rate|inflation)\b/.test(text)) return "forex";
  if (/\b(stock|stocks|share|shares|nasdaq|dow|s&p|wall street|equity|equities|earnings)\b/.test(text)) return "stocks";
  return "markets";
}

function parseFeed(xml: string, source: string): NewsArticle[] {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi))
    .map((match) => {
      const item = match[0];
      const title = readTag(item, "title");
      const url = readTag(item, "link") || readTag(item, "guid");
      const summary = readTag(item, "description");
      const published = readTag(item, "pubDate") || readTag(item, "dc:date");
      const publishedAt = published && !Number.isNaN(Date.parse(published))
        ? new Date(published).toISOString()
        : new Date(0).toISOString();

      return {
        id: `${source}:${url || title}`.slice(0, 240),
        title,
        summary: summary.slice(0, 260),
        url,
        source,
        category: classifyArticle(title, summary),
        publishedAt,
        imageUrl: readAttribute(item, "media:content", "url") || readAttribute(item, "media:thumbnail", "url"),
      };
    })
    .filter((article) => article.title && /^https?:\/\//.test(article.url))
    .map(({ imageUrl: _imageUrl, ...article }) => article)
    .slice(0, 20);
}

async function fetchFeed(feed: Feed): Promise<NewsArticle[]> {
  const response = await fetch(feed.url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": "VIXUS-AI-News/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${feed.source} returned ${response.status}`);
  return parseFeed(await response.text(), feed.source);
}

async function getNews(): Promise<NewsArticle[]> {
  if (Date.now() - cachedAt < CACHE_TTL_MS && cachedArticles.length > 0) return cachedArticles;

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  const articles = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((article) => {
      const key = article.url || article.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 30);

  if (articles.length > 0) {
    cachedArticles = articles;
    cachedAt = Date.now();
  }
  return articles;
}

const router: IRouter = Router();

router.get("/news", async (_req, res) => {
  try {
    const articles = await getNews();
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.json({ articles, updatedAt: new Date(cachedAt || Date.now()).toISOString() });
  } catch (error) {
    reqLog(error);
    res.status(502).json({ error: "Live market news is temporarily unavailable." });
  }
});

function reqLog(error: unknown) {
  console.error("News feed request failed", error);
}

export default router;