import React from 'react';
import { useGlobalStatus, STATUS_STATES } from '../../lib/useStatusOperations';
import { useSupabase } from '../../contexts/SupabaseContext';

/**
 * Global status indicator component
 * Shows overall app status and active operations
 */
export default function GlobalStatusIndicator() {
  // Debug: log on every render
  // eslint-disable-next-line no-console
  console.log('[GlobalStatusIndicator] render, userStatus:', useSupabase().userStatus);
  const { operations, clearCompletedOperations } = useGlobalStatus();
  const { connectionError, connectionState, userStatus } = useSupabase();
  // Debug: log userStatus on every render
  // eslint-disable-next-line no-console
  console.log('[GlobalStatusIndicator] userStatus:', userStatus);

  const activeOperations = Array.from(operations.values()).filter(op =>
    op.state === STATUS_STATES.RUNNING
  );

  const recentErrors = Array.from(operations.values())
    .filter(op => op.state === STATUS_STATES.ERROR)
    .slice(-3); // Show last 3 errors


  // Show auth state indicator if not signed in
  const showAuthState = userStatus && userStatus !== 'signed_in';
  const hasConnectionIssue = connectionError || connectionState === 'error' || connectionState === 'disconnected';
  const hasIssues = activeOperations.length > 0 || recentErrors.length > 0 || hasConnectionIssue || showAuthState;

  // Show info only in transient states
  const showTransientInfo = userStatus === 'signing_in';
  if (!hasIssues) {
    return null; // Don't show anything if everything is fine
  }
  if (!showTransientInfo && !hasConnectionIssue && activeOperations.length === 0 && recentErrors.length === 0) {
    return null;
  }

  // Always render overlay for smooth transitions
  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center pointer-events-none transition-all duration-300 ${hasIssues ? 'opacity-100' : 'opacity-0'} select-none`}
      aria-live="polite"
      aria-atomic="true"
      style={{ top: 0, left: 0, right: 0, bottom: 'auto', minHeight: 0 }}
    >
      <div
        className={`w-full max-w-sm mt-6 pointer-events-auto transition-transform duration-300 ${hasIssues ? 'translate-y-0' : '-translate-y-8'} drop-shadow-xl`}
        style={{ position: 'relative' }}
      >
        {/* Only render content if there are issues */}
        <>
            {/* Auth State Indicator */}
            {showAuthState && (
              <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-2 shadow-lg">
                <div className="flex items-center mb-1">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-yellow-800 text-sm font-medium">
                    {userStatus === 'signed_out' && 'Utilisateur non connecté'}
                    {userStatus === 'signing_in' && 'Connexion en cours...'}
                    {userStatus !== 'signed_out' && userStatus !== 'signing_in' && `État: ${userStatus}`}
                  </span>
                </div>
                <div className="text-xs text-yellow-700">
                  {userStatus === 'signed_out' && 'Veuillez vous connecter pour accéder à toutes les fonctionnalités.'}
                  {userStatus === 'signing_in' && 'Connexion à votre compte, veuillez patienter...'}
                </div>
              </div>
            )}
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
          </>
      </div>
    </div>
  );
}