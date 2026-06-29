import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  errorClassName,
  extractAuthError,
  fieldClassName,
  labelClassName,
} from "@/lib/authError";

export function LoginForm() {
  const { login } = useAuth();
  const [loginUsername, setLoginUsername] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ username: loginUsername, password: loginPassword });
    } catch (err) {
      setError(extractAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div>
        <label htmlFor="login-username" className={labelClassName}>
          Username
        </label>
        <input
          id="login-username"
          name="login-username"
          type="text"
          value={loginUsername}
          onChange={(e) => setLoginUsername(e.target.value)}
          autoComplete="username"
          required
          minLength={4}
          className={fieldClassName}
        />
      </div>

      <div>
        <label htmlFor="login-password" className={labelClassName}>
          Password
        </label>
        <input
          id="login-password"
          name="login-password"
          type="password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
          className={fieldClassName}
        />
      </div>

      {error && <div className={errorClassName}>{error}</div>}

      <Button
        type="submit"
        className="w-full py-6 text-lg font-bold bg-primary hover:bg-primary/80 text-primary-foreground"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Signing in...
          </span>
        ) : (
          "Sign In"
        )}
      </Button>
    </form>
  );
}
