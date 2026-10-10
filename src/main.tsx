import { DialogProvider } from "./components/feedback/DialogProvider";
import MobileRuntime from "./components/feedback/MobileRuntime";
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider } from "./auth/AuthContext";
import { NotificationProvider } from "./notifications/NotificationContext";
import NotificationPermissionPrompt from "./notifications/NotificationPermissionPrompt";

const router = createBrowserRouter([{ path: "*", element: <><MobileRuntime /><App /></> }]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <DialogProvider>
      <AuthProvider>
        <NotificationProvider>
        <RouterProvider router={router} />
        <NotificationPermissionPrompt />
        </NotificationProvider>
      </AuthProvider>
      </DialogProvider>
    </ThemeProvider>
  </React.StrictMode>
);
