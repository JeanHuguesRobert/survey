import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function LegalMarkdown({ file }) {
  const [content, setContent] = useState("");
  useEffect(() => {
    fetch(file)
      .then(res => res.text())
      .then(setContent);
  }, [file]);
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// Utilisation dans une page ou un footer :
export default function LegalLinks() {
  return (
    <footer>
      <a href="/docs/terms-of-use.md" target="_blank" rel="noopener noreferrer">Conditions d'utilisation</a>
      {" | "}
      <a href="/docs/privacy-policy.md" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>
    </footer>
  );
}

// Ou pour affichage intégré Markdown :
export function LegalPage({ type }) {
  const file = type === "privacy"
    ? "/docs/privacy-policy.md"
    : "/docs/terms-of-use.md";
  return <LegalMarkdown file={file} />;
}


