import React from "react";
import { createRoot } from "react-dom/client";
import PublicProfilePage from "./PublicProfilePage.jsx";

createRoot(document.getElementById("profile-preview")).render(
  <React.StrictMode>
    <PublicProfilePage isOwner />
  </React.StrictMode>,
);
