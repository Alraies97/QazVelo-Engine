import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "qazvelo_access_token";
export const REFRESH_TOKEN_KEY = "qazvelo_refresh_token";

export function getAccessToken(): string | null {
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const DEFAULT_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || "/api/v1";
const resolvedBaseURL = import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_PATH;

import axios from 'axios';
const api = axios.create({
 baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
});
export default api;

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

interface RetriableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const refreshToken = getRefreshToken();

    const isAuthEndpoint = (original?.url ?? "").includes("/auth/");

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      refreshToken &&
      !isAuthEndpoint
    ) {
      original._retry = true;
      try {
        const { data } = await axios.post<{
          access_token: string;
          refresh_token: string;
        }>(`${api.defaults.baseURL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setTokens(data.access_token, data.refresh_token);
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${data.access_token}`,
        };
        return api(original);
      } catch (refreshError) {
        clearTokens();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
