import React from 'react';

export default function ConnectionBanner({ connectionError, connectionState, realtimeStatus, authEvent, onRetry }) {
  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'green';
      case 'connecting': 
      case 'reconnecting': return 'yellow';
      case 'error': return 'red';
      case 'disconnected': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Connecté';
      case 'connecting': return 'Connexion...';
      case 'reconnecting': return 'Reconnexion...';
      case 'error': return 'Erreur';
      case 'disconnected': return 'Déconnecté';
      default: return 'Inconnu';
    }
  };

  const getRealtimeStatusText = () => {
    switch (realtimeStatus) {
      case 'subscribed': return 'Realtime: Actif';
      case 'subscribing': return 'Realtime: Connexion...';
      case 'rejoining': return 'Realtime: Reconnexion...';
      case 'closed': return 'Realtime: Fermé';
      case 'timed_out': return 'Realtime: Timeout';
      case 'channel_error': 
      case 'error': return 'Realtime: Erreur';
      default: return `Realtime: ${realtimeStatus || 'Inconnu'}`;
    }
  };

  const getAuthStatusText = () => {
    if (!authEvent) return null;
    switch (authEvent) {
      case 'SIGNED_IN': return 'Auth: Connecté';
      case 'SIGNED_OUT': return 'Auth: Déconnecté';
      case 'TOKEN_REFRESHED': return 'Auth: Token rafraîchi';
      default: return `Auth: ${authEvent}`;
    }
  };

  const statusColor = getStatusColor();
  const statusText = getStatusText();

  return (
    <div className={`bg-${statusColor}-100 border-l-4 border-${statusColor}-500 text-${statusColor}-700 p-4 mb-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className={`h-5 w-5 text-${statusColor}-400`} viewBox="0 0 20 20" fill="currentColor">
              {connectionState === 'connected' ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              ) : connectionState === 'error' ? (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              )}
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm">
              <strong>Database Status:</strong> {statusText}
              {connectionError && (
                <span className="ml-2">- {connectionError}</span>
              )}
            </p>
            <div className="text-xs text-gray-600 mt-1 space-y-1">
              <div>{getRealtimeStatusText()}</div>
              {getAuthStatusText() && <div>{getAuthStatusText()}</div>}
            </div>
            {connectionError && (
              <p className="text-sm mt-1">
                Check your Supabase API key in the dashboard and ensure VITE_SUPABASE_ANON_KEY is correct in your .env file.
              </p>
            )}
          </div>
        </div>
        {onRetry && (connectionError || connectionState !== 'connected') && (
          <button
            onClick={onRetry}
            className={`px-3 py-1 text-sm bg-${statusColor}-600 text-white rounded hover:bg-${statusColor}-700 transition-colors`}
          >
            Retest
          </button>
        )}
      </div>
    </div>
  );
}