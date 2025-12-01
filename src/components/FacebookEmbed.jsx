// src/components/FacebookEmbed.jsx

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

export default function FacebookEmbed({ url, className = "" }) {
  const [html, setHtml] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setLoading(true);
    setHtml(null);
    setShowLink(false);

    fetch(`/api/facebook-oembed?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;

        if (data?.embed_available === false) {
          // backend signalled unavailability => fallback to iframe/SDK
          console.error("facebook-oembed unavailable:", data.fb_body || data.error || data);
          setShowLink(true);
          return;
        }

        if (data?.html) {
          setHtml(data.html);
          return;
        }

        if (typeof data === "string" && data.trim().startsWith("<")) {
          setHtml(data);
          return;
        }

        console.error("facebook-oembed unexpected response:", data);
        setShowLink(true);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("facebook-oembed fetch error", err);
        setShowLink(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  // Log a clear warning once when using the client-side iframe fallback
  useEffect(() => {
    if (showLink && url) {
      // eslint-disable-next-line no-console
      console.warn(
        "Using client-side Facebook plugin iframe as a temporary fallback for",
        url,
        "- this may require Facebook login/HTTPS and is less reliable than server-side oEmbed."
      );
    }
  }, [showLink, url]);

  if (loading) return <div className={className}>Loading Facebook content…</div>;

  if (html)
    return (
      <div
        className={`facebook-embed ${className}`}
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    );

  if (showLink)
    return (
      <div className={className}>
        <div style={{ width: "100%", maxWidth: 750, margin: "0 auto" }}>
          <iframe
            title="Facebook post"
            src={`https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
              url
            )}&show_text=true&width=500`}
            style={{
              border: "none",
              overflow: "hidden",
              width: "100%",
              height: 600,
            }}
            scrolling="no"
            allowFullScreen={true}
            loading="lazy"
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            View on Facebook
          </a>
        </div>
      </div>
    );

  return null;
}
