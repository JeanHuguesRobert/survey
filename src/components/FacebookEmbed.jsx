import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

export default function FacebookEmbed({ url, className = "" }) {
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/facebook-oembed?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.html) setHtml(data.html);
        else setError("No embed available");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("facebook-oembed error", err);
        setError("Failed to load embed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (loading) return <div className={className}>Loading Facebook content…</div>;
  if (error) return <div className={className}>Facebook embed error: {error}</div>;
  if (!html) return null;

  return (
    <div
      className={`facebook-embed ${className}`}
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
    />
  );
}
