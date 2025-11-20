import React from 'react';
import { useGlobalStatus, STATUS_STATES } from '../../lib/useStatusOperations';
import { useSupabase } from '../../contexts/SupabaseContext';

/**
 * Global status indicator component
 * Shows overall app status and active operations
 */
export default function GlobalStatusIndicator() {
  const { operations, clearCompletedOperations } = useGlobalStatus();
  const { connectionError, connectionState } = useSupabase();

  const activeOperations = Array.from(operations.values()).filter(op =>
    op.state === STATUS_STATES.RUNNING
  );

  const recentErrors = Array.from(operations.values())
    .filter(op => op.state === STATUS_STATES.ERROR)
    .slice(-3); // Show last 3 errors

  const hasConnectionIssue = connectionError || connectionState === 'error' || connectionState === 'disconnected';
  const hasIssues = activeOperations.length > 0 || recentErrors.length > 0 || hasConnectionIssue;

  if (!hasIssues) {
    return null; // Don't show anything if everything is fine
  }

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      {/* Connection Issues */}
      {hasConnectionIssue && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-2 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-red-800 text-sm font-medium">
                Problème de connexion
              </span>
            </div>
          </div>
          <div className="text-xs text-red-700">
            {connectionError || 'Connexion perdue - certaines fonctionnalités peuvent ne pas fonctionner'}
          </div>
        </div>
      )}

      {/* Active Operations */}
      {activeOperations.length > 0 && (
        <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-2 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-blue-800 text-sm font-medium">
                {activeOperations.length} opération{activeOperations.length > 1 ? 's' : ''} en cours
              </span>
            </div>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {activeOperations.slice(0, 3).map(op => (
              <div key={op.id} className="text-xs text-blue-700">
                <div className="font-medium truncate">{op.description}</div>
              </div>
            ))}
            {activeOperations.length > 3 && (
              <div className="text-xs text-blue-600">
                +{activeOperations.length - 3} autres...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="bg-red-100 border border-red-300 rounded-lg p-3 mb-2 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
              <span className="text-red-800 text-sm font-medium">
                {recentErrors.length} erreur{recentErrors.length > 1 ? 's' : ''} récente{recentErrors.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={clearCompletedOperations}
              className="text-red-600 hover:text-red-800 text-xs underline"
            >
              Effacer
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {recentErrors.map(op => (
              <div key={op.id} className="text-xs text-red-700">
                <div className="font-medium truncate">{op.description}</div>
                <div className="text-red-600 truncate">{op.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}