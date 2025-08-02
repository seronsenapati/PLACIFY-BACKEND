import axios from "axios";

const { OPENROUTER_API_KEY } = process.env;

if (!OPENROUTER_API_KEY) {
  throw new Error(
    "❌ OPENROUTER_API_KEY is missing from environment variables."
  );
}

// Create Axios instance for OpenRouter API
const openRouterAPI = axios.create({
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "HTTP-Referer": process.env.SITE_URL || "https://placify.app", // Optionally set in .env
    "X-Title": "Placify Job Generator",
  },
});

export default openRouterAPI;
