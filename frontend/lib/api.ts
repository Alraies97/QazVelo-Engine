import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const ACCESS_TOKEN_KEY = "qazvelo_access_token";
export const REFRESH_TOKEN_KEY = "qazvelo_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: attach the JWT access token from localStorage.
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

// Response interceptor: on a 401, try a single token refresh, then replay the
// original request. If refresh fails, clear tokens so the app can re-auth.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableRequestConfig | undefined;
    const refreshToken = getRefreshToken();

    // Never run the refresh-and-retry flow for the auth endpoints themselves.
    // A failed login/register/refresh must surface its own error to the form
    // instead of triggering a token refresh that churns auth state.
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

export default api;
