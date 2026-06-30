import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Minta penyimpanan persisten agar IndexedDB tidak mudah di-evict.
if (navigator.storage?.persist) {
  void navigator.storage.persist();
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
