// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import ErrorBoundary from './components/common/ErrorBoundary';
import { SupabaseProvider } from './contexts/SupabaseContext';
import './index.css'; // Import des styles globaux

ReactDOM.createRoot(document.getElementById("root")).render(
  <SupabaseProvider>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </BrowserRouter>
  </SupabaseProvider>
);