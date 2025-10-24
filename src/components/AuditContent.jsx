import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { APP_VERSION, DEPLOY_DATE } from '../constants';

export default function AuditContent() {
  const [markdownContent, setMarkdownContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Charger le fichier Markdown
    fetch('/docs/audit-ethique.md')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur lors du chargement du rapport: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        setMarkdownContent(text);
        setLoading(false);
      })
      .catch(err => {
        console.error('Erreur lors du chargement du rapport:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 my-4">
        <p className="text-red-700">Impossible de charger le rapport d'audit éthique: {error}</p>
        <p className="mt-2">Veuillez réessayer ultérieurement ou contacter l'administrateur.</p>
      </div>
    );
  }

  return (
    <div className="prose prose-blue max-w-none">
      <div className="markdown-content">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
        >
          {markdownContent}
        </ReactMarkdown>
      </div>
      
      <hr />
      <p className="text-sm text-gray-500 mt-8">Document public - Reproduction et partage encouragés avec mention de la source</p>
    </div>
  );
}
