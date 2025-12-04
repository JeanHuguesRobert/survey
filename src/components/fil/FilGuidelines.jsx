import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import SiteFooter from "../layout/SiteFooter";
import { Link } from "react-router-dom";

export default function FilGuidelines() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContent() {
      try {
        const res = await fetch("/docs/fil-guidelines.md");
        if (res.ok) {
          setContent(await res.text());
        } else {
          setContent("# Guidelines\n\nContenu non disponible.");
        }
      } catch {
        setContent("# Guidelines\n\nErreur de chargement.");
      } finally {
        setLoading(false);
      }
    }
    loadContent();
  }, []);

  const styles = {
    container: {
      maxWidth: 800,
      margin: "0 auto",
      background: "var(--color-bg-app)",
      minHeight: "100vh",
    },
    header: {
      background: "var(--color-action-primary)",
      padding: "4px 8px",
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    logo: {
      width: 20,
      height: 20,
      border: "1px solid var(--color-bg-app)",
    },
    title: {
      fontFamily: "var(--font-display)",
      fontWeight: 700,
      fontSize: "0.9rem",
      color: "var(--color-bg-app)",
      textDecoration: "none",
    },
    navLink: {
      fontSize: "0.75rem",
      color: "var(--color-bg-app)",
      textDecoration: "none",
      marginLeft: 8,
    },
    content: {
      padding: "16px",
      fontFamily: "var(--font-body)",
      lineHeight: 1.6,
    },
  };

  return (
    <>
      <div style={styles.container}>
        <div style={styles.header}>
          <img src="/images/favicon.svg" alt="" style={styles.logo} />
          <Link to="/fil" style={styles.title}>
            Le Fil
          </Link>
          <Link to="/fil/new" style={styles.navLink}>
            soumettre
          </Link>
          <span style={{ flex: 1 }} />
          <Link to="/fil/guidelines" style={{ ...styles.navLink, fontWeight: 700 }}>
            règles
          </Link>
          <Link to="/fil/faq" style={styles.navLink}>
            faq
          </Link>
        </div>
        <div style={styles.content}>
          {loading ? <p>Chargement...</p> : <ReactMarkdown>{content}</ReactMarkdown>}
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
