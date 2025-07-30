import axios from "axios";

const openRouterAPI = axios.create({
  baseURL: "https://openrouter.ai/api/v1",
  headers: {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "HTTP-Referer": "https://placify.app", // replace with your real domain
    "X-Title": "Placify Job Generator",
  },
});

export default openRouterAPI;
