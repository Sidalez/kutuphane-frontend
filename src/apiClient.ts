import { beginActivity } from "./requestActivity";
import axios from "axios";

// Çevre değişkeninden (env) backend adresini al
const envUrl = import.meta.env.VITE_API_URL;

// Eğer env boşsa, yedek olarak localhost:3001 kullan
export const API_BASE_URL =
  (typeof envUrl === "string" && envUrl.trim().length > 0
    ? envUrl.trim()
    : "http://localhost:3001");

console.log("API BASE URL:", API_BASE_URL);

// Ortak axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

const activeRequests = new WeakMap<object, () => void>();
api.interceptors.request.use(config => { activeRequests.set(config, beginActivity()); return config; });
api.interceptors.response.use(response => { activeRequests.get(response.config)?.(); return response; }, error => { if (error.config) activeRequests.get(error.config)?.(); return Promise.reject(error); });
