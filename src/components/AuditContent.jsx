import React from 'react';
import { APP_VERSION, DEPLOY_DATE } from '../constants';

export default function AuditContent() {
  return (
    <div className="prose prose-blue max-w-none">
      <h1>Rapport d'audit éthique - Consultation citoyenne Pertitellu</h1>
      <p className="text-gray-600 italic">Version {APP_VERSION} - généré le {DEPLOY_DATE}</p>

      <h2>Synthèse</h2>
      // ...existing code du rapport converti en JSX...

      <hr />
      <p className="text-sm text-gray-500">Document public - Reproduction et partage encouragés avec mention de la source</p>
    </div>
  );
}
