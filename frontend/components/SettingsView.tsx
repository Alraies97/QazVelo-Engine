"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function SettingsView() {
  const { user } = useAuth();

  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fieldClass =
    "w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-2";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", message: "New passwords do not match" });
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/users/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setFeedback({
        type: "success",
        message: "Password updated successfully.",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setFeedback({
        type: "error",
        message: detail ?? "Could not update password. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile details and account security.
        </p>
      </div>

      {/* Profile */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Profile</h2>
        {user ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Username</dt>
              <dd className="text-foreground font-medium">{user.username}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground font-medium">{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="text-foreground font-medium">{user.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-medium",
                    user.is_active
                      ? "bg-green-600/10 text-green-500"
                      : "bg-red-600/10 text-red-500"
                  )}
                >
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        )}
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Change Password
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="old-password" className={labelClass}>
              Current Password
            </label>
            <input
              id="old-password"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="new-password" className={labelClass}>
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className={labelClass}>
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              className={fieldClass}
            />
          </div>

          {feedback && (
            <div
              className={cn(
                "text-sm rounded-lg px-3 py-2",
                feedback.type === "success"
                  ? "bg-green-600/10 text-green-500"
                  : "bg-red-600/10 text-red-500"
              )}
            >
              {feedback.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="font-bold"
          >
            {submitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
