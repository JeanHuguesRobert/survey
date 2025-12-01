import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { linkifyWardWiki } from "../../lib/wikiLinks";

export function LegalMarkdown({ file }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState(null);
  useEffect(() => {
    let isMounted = true;

    async function loadMarkdown() {
      if (!file) return;
      try {
        const urlWithRaw = appendRawParam(file);
        const res = await fetch(urlWithRaw, {
          headers: { Accept: "text/plain, text/markdown" },
        });
        if (!res.ok) throw new Error(`Impossible de charger ${file}`);
        const text = await res.text();
        if (isMounted) {
          setContent(text);
          setError(null);
        }
      } catch (err) {
        console.error("Markdown fetch error:", err);
        if (isMounted) {
          setError(err.message || "Erreur de chargement");
        }
      }
    }

    loadMarkdown();

    return () => {
      isMounted = false;
    };
  }, [file]);

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }
  return (
    // apply site markdown typography (Tailwind Typography / prose) while keeping legacy "markdown-content"
    <div className="markdown-content prose max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{linkifyWardWiki(content)}</ReactMarkdown>
    </div>
  );
}

function appendRawParam(path) {
  if (!path) return path;
  if (path.includes("raw=1")) return path;
  return path.includes("?") ? `${path}&raw=1` : `${path}?raw=1`;
}

// Utilisation dans une page ou un footer :
export default function LegalLinks() {
  return (
    <footer className="prose max-w-none mx-auto p-4 border-t mt-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Conditions d'utilisation</h2>
        <LegalPage type="terms" />
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Politique de confidentialité</h2>
        <LegalPage type="privacy" />
      </div>
      <div className="mt-8 text-center">
        <a
          href="/contact"
          className="inline-block px-4 py-2 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
        >
          Contactez-nous
        </a>
      </div>
    </footer>
  );
}

// Ou pour affichage intégré Markdown :
export function LegalPage({ type }) {
  const file = type === "privacy" ? "/docs/privacy-policy.md" : "/docs/terms-of-use.md";
  return (
    <>
      <LegalMarkdown file={file} />
      <div className="mt-8 text-center">
        <a
          href="/contact"
          className="inline-block px-4 py-2 bg-blue-600 text-bauhaus-white hover:bg-blue-700 font-semibold shadow"
        >
          Contactez-nous
        </a>
      </div>
    </>
  );
}
