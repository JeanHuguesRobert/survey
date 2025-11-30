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
