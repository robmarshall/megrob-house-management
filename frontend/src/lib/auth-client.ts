import { createAuthClient } from "better-auth/react";

const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error("Missing VITE_API_URL environment variable");
}

export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
});
