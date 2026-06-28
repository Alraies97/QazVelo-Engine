export interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}

export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
}

export enum OrderSide {
  BUY = "BUY",
  SELL = "SELL",
}

export enum OrderStatus {
  PENDING = "PENDING",
  EXECUTED = "EXECUTED",
  CANCELED = "CANCELED",
}

export enum AlertCondition {
  ABOVE = "above",
  BELOW = "below",
}

export interface MockWallet {
  id: number;
  user_id: number;
  balance: number;
  currency: string;
  created_at: string;
}

export interface MockPosition {
  id: number;
  wallet_id: number;
  asset_symbol: string;
  quantity: number;
  average_entry_price: number;
  updated_at: string;
}

export interface MockOrder {
  id: number;
  wallet_id: number;
  asset_symbol: string;
  order_type: OrderType;
  side: OrderSide;
  price?: number;
  quantity: number;
  status: OrderStatus;
  created_at: string;
}

export interface WalletSummary {
  wallet: MockWallet;
  positions: MockPosition[];
  recent_orders: MockOrder[];
}

export interface PriceAlert {
  id: number;
  user_id: number;
  asset_symbol: string;
  target_price: number;
  condition: AlertCondition;
  is_active: boolean;
  triggered_at?: string;
  created_at: string;
}

export interface PriceAlertCreate {
  asset_symbol: string;
  target_price: number;
  condition: AlertCondition;
}

export interface MockOrderCreate {
  asset_symbol: string;
  order_type: OrderType;
  side: OrderSide;
  price?: number;
  quantity: number;
}

export interface AnalyticsMetrics {
  input_count: number;
  applied_period: number;
  simple_moving_average: number[];
  volatility_standard_deviation: number[];
}

export interface TickerCalculateResponse {
  status: string;
  metrics: AnalyticsMetrics;
  record_id?: number;
  persisted_by?: string;
}

export interface AnalyticsRecord {
  id: number | null;
  user_id: number | null;
  metric_name: string;
  metric_value: number;
  extra_payload: Record<string, unknown> | null;
  timestamp: string;
}

export interface PaginatedAnalyticsResponse {
  total: number;
  page: number;
  page_size: number;
  results: AnalyticsRecord[];
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}
