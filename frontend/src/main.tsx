import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { AuthProvider } from "./lib/auth";
import { ToastProvider } from "./lib/toast";
import { queryClient } from "./lib/query";
import { AppLifecycle } from "./components/AppLifecycle";
import { ScrollRestoration } from "./components/ScrollRestoration";
import { LastRouteTracker } from "./components/LastRouteTracker";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import "./index.css";


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
            <AppLifecycle />
            <ScrollRestoration />
            <LastRouteTracker />
            <PwaUpdatePrompt />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
