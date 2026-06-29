"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  errorClassName,
  extractAuthError,
  fieldClassName,
  labelClassName,
} from "@/lib/authError";

export function RegisterForm() {
  const { register } = useAuth();
  const [registerUsername, setRegisterUsername] = React.useState("");
  const [registerEmail, setRegisterEmail] = React.useState("");
  const [registerPassword, setRegisterPassword] = React.useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] =
    React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerPassword !== registerConfirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register({
        username: registerUsername,
        email: registerEmail,
        password: registerPassword,
      });
    } catch (err) {
      setError(extractAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <div>
        <label htmlFor="register-username" className={labelClassName}>
          Username
        </label>
        <input
          id="register-username"
          name="register-username"
          type="text"
          value={registerUsername}
          onChange={(e) => setRegisterUsername(e.target.value)}
          autoComplete="off"
          required
          minLength={4}
          className={fieldClassName}
        />
      </div>

      <div>
        <label htmlFor="register-email" className={labelClassName}>
          Email
        </label>
        <input
          id="register-email"
          name="register-email"
          type="email"
          value={registerEmail}
          onChange={(e) => setRegisterEmail(e.target.value)}
          autoComplete="off"
          required
          className={fieldClassName}
        />
      </div>

      <div>
        <label htmlFor="register-password" className={labelClassName}>
          Password
        </label>
        <input
          id="register-password"
          name="register-password"
          type="password"
          value={registerPassword}
          onChange={(e) => setRegisterPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClassName}
        />
      </div>

      <div>
        <label htmlFor="register-confirm-password" className={labelClassName}>
          Confirm Password
        </label>
        <input
          id="register-confirm-password"
          name="register-confirm-password"
          type="password"
          value={registerConfirmPassword}
          onChange={(e) => setRegisterConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          className={fieldClassName}
        />
      </div>

      {error && <div className={errorClassName}>{error}</div>}

      <Button
        type="submit"
        className="w-full py-6 text-lg font-bold"
        disabled={loading}
      >
        {loading ? "Please wait..." : "Create Account"}
      </Button>
    </form>
  );
}
