export function extractAuthError(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    .response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  const status = (err as { response?: { status?: number } }).response?.status;
  if (status === 401) return "Incorrect username or password";
  return "Something went wrong. Is the backend running?";
}

export const fieldClassName =
  "w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary";

export const labelClassName =
  "block text-sm font-medium text-muted-foreground mb-2";

export const errorClassName =
  "text-sm rounded-lg px-3 py-2 bg-red-600/10 text-red-500";
