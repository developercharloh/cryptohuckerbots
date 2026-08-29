import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Newspaper, RefreshCw, Search, TrendingUp } from "lucide-react";
import { Layout } from "@/components/Layout";

type NewsCategory = "markets" | "forex" | "stocks" | "commodities" | "crypto";
type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: NewsCategory;
  publishedAt: string;
};
type NewsResponse = { articles: NewsArticle[]; updatedAt: string };

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const FILTERS: { id: "all" | NewsCategory; label: string }[] = [
  { id: "all", label: "All news" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
  { id: "commodities", label: "Commodities" },
  { id: "crypto", label: "Crypto" },
];

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "Latest";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function categoryLabel(category: NewsCategory) {
  return category === "markets" ? "Markets" : category.charAt(0).toUpperCase() + category.slice(1);
}

export default function News() {
  const [filter, setFilter] = useState<"all" | NewsCategory>("all");
  const [search, setSearch] = useState("");
  const { data, isLoading, isError, refetch, isFetching } = useQuery<NewsResponse>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/news`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to load live market news");
      return response.json() as Promise<NewsResponse>;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.articles ?? []).filter((article) => {
      const matchesFilter = filter === "all" || article.category === filter;
      const matchesSearch = !query || `${article.title} ${article.summary} ${article.source}`.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [data?.articles, filter, search]);

  const lead = filtered[0];
  const stories = filtered.slice(1);

  return (
    <Layout showNav>
      <main className="user-news min-h-screen pb-24">
        <section className="news-hero">
          <div className="news-hero-orb news-hero-orb-one" />
          <div className="news-hero-orb news-hero-orb-two" />
          <div className="news-hero-content">
            <div className="news-kicker"><span className="news-live-dot" /> Live market intelligence</div>
            <h1>News that moves<br /><span>the markets.</span></h1>
            <p>Global coverage across forex, stocks, commodities and digital assets — refreshed throughout the trading day.</p>
          </div>
          <div className="news-hero-mark"><Newspaper size={44} strokeWidth={1.3} /></div>
        </section>

        <section className="news-toolbar">
          <div className="news-filter-row">
            {FILTERS.map((item) => (
              <button key={item.id} className={`news-filter ${filter === item.id ? "is-active" : ""}`} onClick={() => setFilter(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <label className="news-search">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search market news" />
          </label>
        </section>

        <section className="news-content">
          <div className="news-section-heading">
            <div>
              <p className="eyebrow">GLOBAL DESK</p>
              <h2>Latest intelligence</h2>
            </div>
            <button className="news-refresh" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw size={14} className={isFetching ? "news-spin" : ""} /> {isFetching ? "Updating" : "Refresh"}
            </button>
          </div>

          {isLoading && <div className="news-state"><div className="news-loader" /> Loading live market coverage…</div>}
          {isError && <div className="news-state news-state-error">Live sources are temporarily unavailable. Try refreshing in a moment.</div>}
          {!isLoading && !isError && filtered.length === 0 && (
            <div className="news-state">No stories match this view. Try another category or search term.</div>
          )}

          {lead && (
            <a className="news-lead" href={lead.url} target="_blank" rel="noreferrer">
              <div className="news-lead-accent"><TrendingUp size={20} /></div>
              <div className="news-lead-copy">
                <div className="news-meta"><span>{lead.source}</span><i /> <span>{categoryLabel(lead.category)}</span><i /> <span>{formatTime(lead.publishedAt)}</span></div>
                <h3>{lead.title}</h3>
                {lead.summary && <p>{lead.summary}</p>}
                <span className="news-read-link">Read full story <ExternalLink size={13} /></span>
              </div>
            </a>
          )}

          {stories.length > 0 && (
            <div className="news-grid">
              {stories.map((article) => (
                <a key={article.id} className="news-card" href={article.url} target="_blank" rel="noreferrer">
                  <div className="news-card-top"><span className="news-category">{categoryLabel(article.category)}</span><ExternalLink size={14} /></div>
                  <h3>{article.title}</h3>
                  {article.summary && <p>{article.summary}</p>}
                  <div className="news-card-footer"><span>{article.source}</span><span>{formatTime(article.publishedAt)}</span></div>
                </a>
              ))}
            </div>
          )}

          {data?.updatedAt && <p className="news-updated">Feeds last checked {formatTime(data.updatedAt)} · Sources: CNBC Markets, MarketWatch, Yahoo Finance</p>}
        </section>
      </main>
    </Layout>
  );
}