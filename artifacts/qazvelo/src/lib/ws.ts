import { getAccessToken } from "@/lib/api";

interface WSCallbacks {
  onOpen?: () => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (wasClean: boolean) => void;
  onError?: (err: Event) => void;
}

export class ReconnectingWebSocket {
  private url: string;
  private callbacks: WSCallbacks;
  private ws: WebSocket | null = null;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(url: string, callbacks: WSCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      this.callbacks.onError?.(err as Event);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.callbacks.onOpen?.();
    };

    this.ws.onmessage = (event) => {
      this.callbacks.onMessage?.(event);
    };

    this.ws.onclose = (ev) => {
      this.callbacks.onClose?.(ev.wasClean);
      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (err) => {
      this.callbacks.onError?.(err);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  start() {
    this.shouldReconnect = true;
    this.connect();
  }

  stop() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

export function buildWebSocketUrl(path: string, symbol?: string): string {
  const token = getAccessToken();
  
  const envBaseUrl = import.meta.env.VITE_WS_BASE_URL;
  
  let baseUrl: string;

  if (envBaseUrl) {
    baseUrl = envBaseUrl;
  } else {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    baseUrl = `${protocol}//${window.location.host}`;
  }

  const url = new URL(`${baseUrl}${path}`);
  
  if (symbol) url.searchParams.set("symbol", symbol);
  if (token) url.searchParams.set("token", token);
  
  return url.toString();
}
