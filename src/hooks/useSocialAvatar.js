import { useState, useEffect } from "react";

export function useSocialAvatar(provider) {
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/oauth-start?provider=${provider}`);
      if (!response.ok) throw new Error("Failed to start OAuth flow");

      const { authUrl } = await response.json();
      // Redirect to provider
      window.location.href = authUrl;
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoading(false);
    }
  };

  const completeIfCallback = async (userId) => {
    const path = window.location.pathname;
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const code = params.get("code");

    // Check if we are on the correct callback path for this provider
    // Note: This path check must match the redirectPath in oauthProviders.js
    const expectedPath = `/oauth/${provider}/callback`;

    if (path === expectedPath && code) {
      setLoading(true);
      try {
        const response = await fetch("/api/oauth-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, code, userId }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Failed to complete OAuth flow");
        }

        const data = await response.json();
        setAvatarUrl(data.avatarUrl);

        // TODO: Send this info to backend to update persistent user profile if not already done by the function
        // In our current design, the function "storeAvatarForUser" is a mock, so we might need to do something here
        // or just rely on the returned URL to update the local form state.

        return data.avatarUrl;
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
        // Optional: Clean up URL
        window.history.replaceState({}, document.title, "/profile"); // Redirect back to profile or wherever
      }
    }
    return null;
  };

  return {
    avatarUrl,
    loading,
    error,
    start,
    completeIfCallback,
  };
}
