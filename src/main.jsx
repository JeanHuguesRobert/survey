// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import ErrorBoundary from "./components/common/ErrorBoundary";
import { SupabaseProvider } from "./contexts/SupabaseContext";
import { GlobalStatusProvider } from "./contexts/GlobalStatusContext";
import { CurrentUserProvider } from "./contexts/CurrentUserContext";
import "./styles/index.css"; // Import des styles globaux (New Architecture)

// Conditionally load Facebook JS SDK when a client App ID is provided
const FB_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID;
if (FB_APP_ID) {
  window.fbAsyncInit = function () {
    try {
      FB.init({
        appId: FB_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v16.0",
      });

      // Example: check login status right after init (no-op if not used)
      FB.getLoginStatus(function (response) {
        // response.status can be: 'connected', 'not_authorized', 'unknown'
        console.log("FB login status:", response);
      });
    } catch (e) {
      console.error("FB SDK init error", e);
    }
  };

  (function (d, s, id) {
    if (d.getElementById(id)) return;
    const js = d.createElement(s);
    js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    const fjs = d.getElementsByTagName(s)[0];
    fjs.parentNode.insertBefore(js, fjs);
  })(document, "script", "facebook-jssdk");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <SupabaseProvider>
    <CurrentUserProvider>
      <GlobalStatusProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </GlobalStatusProvider>
    </CurrentUserProvider>
  </SupabaseProvider>
);
