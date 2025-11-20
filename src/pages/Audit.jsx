import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { MOVEMENT_NAME, CITY_NAME, BOT_NAME, PARTY_NAME, HASHTAG } from "../constants";
import SiteFooter from '../components/layout/SiteFooter';

export default function Audit() {
  const [auditContent, setAuditContent] = useState("");

  useEffect(() => {
    fetch("/docs/audit-ethique.md")
      .then((res) => res.text())
      .then((raw) => {
        const replacements = {
          "{{MOVEMENT_NAME}}": MOVEMENT_NAME,
          "{{CITY_NAME}}": CITY_NAME,
          "{{BOT_NAME}}": BOT_NAME,
          "{{PARTY_NAME}}": PARTY_NAME,
          "{{HASHTAG}}": HASHTAG,
        };
        let parsed = raw;
        Object.entries(replacements).forEach(([key, value]) => {
          if (value) {
            parsed = parsed.split(key).join(value);
          }
        });
        setAuditContent(parsed);
      })
      .catch(() => setAuditContent(null));
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 space-y-8">
        <div className="text-center">
          <div className="mb-4">
            <div className="text-5xl font-bold text-accent-orange">
              {HASHTAG}
            </div>
            <div className="h-1 bg-blue-900 my-3 max-w-2xl mx-auto"></div>
            <div className="text-4xl font-bold text-blue-900">
              {CITY_NAME.toUpperCase()}<br/>CAPITALE
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-xl p-8">
          {auditContent ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {auditContent}
            </ReactMarkdown>
          ) : (
            <div className="text-center">No content available</div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="px-4 py-2 bg-gray-100 text-blue-900 font-semibold rounded-md hover:bg-gray-200">
            Retour à la consultation
          </Link>
        </div>

        <div className="mt-8">
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
