import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  date: string;
  url: string;
  content: string;
  filename: string;
}

export function NewsList() {
  const [ticker, setTicker] = useState<string>("");
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const select = document.getElementById("bar-select") as HTMLSelectElement;
    if (select?.value) setTicker(select.value);

    const handler = (e: Event) => {
      setTicker((e.target as HTMLSelectElement).value);
      setExpanded(null);
    };

    select?.addEventListener("change", handler);
    return () => select?.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!ticker) return;
    setNewsList([]);
    setLoading(true);

    loadNewsForTicker(ticker).then((items) => {
      setNewsList(items);
      setLoading(false);
    });
  }, [ticker]);

  return (
    <div style={{ width: "100%", height: "100%", overflowY: "auto", padding: "0.5rem" }}>
      <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
        {ticker ? `${ticker} News` : "Select a stock"}
      </p>

      {newsList.map((item, i) => (
        <div
          key={i}
          style={{
            marginBottom: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          <div
            onClick={() => setExpanded(expanded === String(i) ? null : String(i))}
            style={{
              padding: "0.5rem 0.75rem",
              cursor: "pointer",
              background: expanded === String(i) ? "#e8f0fe" : "#f9f9f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "0.5rem",
            }}
          >
            <div>
              <p style={{ margin: 0, fontWeight: "600", fontSize: "0.85rem" }}>
                {item.title}
              </p>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#666" }}>
                {item.date}
              </p>
            </div>
            <span style={{ fontSize: "0.8rem", color: "#888", flexShrink: 0 }}>
            </span>
          </div>

          {expanded === String(i) && (
            <div
              style={{
                padding: "0.75rem",
                fontSize: "0.8rem",
                lineHeight: "1.5",
                background: "#fff",
                borderTop: "1px solid #ddd",
                whiteSpace: "pre-wrap",
              }}
            >
              {item.content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Load all txt file contents at build time
const allNewsFiles = import.meta.glob("../../data/stocknews/**/*.txt", {
  as: "raw",
  eager: false,
});

async function loadNewsForTicker(ticker: string): Promise<NewsItem[]> {
  const prefix = `../../data/stocknews/${ticker}/`;

  const matchingKeys = Object.keys(allNewsFiles).filter((k) =>
    k.startsWith(prefix)
  );

  const items: NewsItem[] = await Promise.all(
    matchingKeys.map(async (key) => {
      const raw = (await allNewsFiles[key]()) as string;
      return parseNewsFile(raw, key);
    })
  );

  items.sort((a, b) => b.date.localeCompare(a.date));
  return items;
}

function parseNewsFile(raw: string, filepath: string): NewsItem {
  const lines = raw.split("\n");
  let title = "";
  let date = "";
  let url = "";
  let contentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("Title: ")) {
      title = lines[i].replace("Title: ", "").trim();
    } else if (lines[i].startsWith("Date: ")) {
      date = lines[i].replace("Date: ", "").trim();
    } else if (lines[i].startsWith("URL: ")) {
      url = lines[i].replace("URL: ", "").trim();
    } else if (lines[i].trim() === "" && title && date) {
      contentStart = i + 1;
      break;
    }
  }

  const content = lines.slice(contentStart).join("\n").trim();
  return { title, date, url, content, filename: filepath };
}