import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// Validate required environment variables before app starts
const requiredEnvVars = ["VITE_API_URL", "VITE_FRONTEND_URL"];

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !import.meta.env[varName]
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error(
    "\nPlease check your .env file and ensure all required variables are set."
  );

  // Show error in the UI
  document.getElementById("root")!.innerHTML = `
    <div style="font-family: system-ui; padding: 2rem; max-width: 600px; margin: 2rem auto; background: #fee; border: 2px solid #c00; border-radius: 8px;">
      <h1 style="color: #c00;">Configuration Error</h1>
      <p>Missing required environment variables:</p>
      <ul>
        ${missingEnvVars.map((v) => `<li><code>${v}</code></li>`).join("")}
      </ul>
      <p>Please check your <code>.env</code> file and ensure all required variables are set.</p>
    </div>
  `;
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
