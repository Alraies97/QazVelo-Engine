"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertCondition } from "@/lib/types";
import type { PriceAlert } from "@/lib/types";

export function SettingsView() {
  const { user, updateUser } = useAuth();

  const [username, setUsername] = React.useState(user?.username ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [profileFeedback, setProfileFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [submittingProfile, setSubmittingProfile] = React.useState(false);
  const [submittingPassword, setSubmittingPassword] = React.useState(false);
  const [alerts, setAlerts] = React.useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = React.useState(true);
  const [alertsError, setAlertsError] = React.useState<string | null>(null);
  const [newAlertAsset, setNewAlertAsset] = React.useState("BTC");
  const [newAlertTarget, setNewAlertTarget] = React.useState(1.0);
  const [newAlertCondition, setNewAlertCondition] = React.useState<AlertCondition>(
    AlertCondition.ABOVE
  );
  const [alertFeedback, setAlertFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setUsername(user?.username ?? "");
    setEmail(user?.email ?? "");
  }, [user]);

  const loadAlerts = React.useCallback(async () => {
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const { data } = await api.get<PriceAlert[]>("/alerts?is_active=true");
      setAlerts(data);
    } catch (err) {
      console.error('loadAlerts failed', err);
      setAlertsError("Failed to load alerts. Please refresh.");
    } finally {
      setAlertsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    setSubmittingProfile(true);

    try {
      const updated = await updateUser({ username, email });
      setProfileFeedback({
        type: "success",
        message: `Profile updated for ${updated.username}`,
      });
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setProfileFeedback({
        type: "error",
        message:
          detail ?? "Could not update your profile. Please check your values.",
      });
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        type: "error",
        message: "New passwords do not match.",
      });
      return;
    }

    setSubmittingPassword(true);
    try {
      await api.post("/users/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setPasswordFeedback({
        type: "success",
        message: "Password updated successfully.",
      });
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setPasswordFeedback({
        type: "error",
        message: detail ?? "Could not update password. Please try again.",
      });
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlertFeedback(null);
    try {
      await api.post<PriceAlert>("/alerts", {
        asset_symbol: newAlertAsset,
        target_price: newAlertTarget,
        condition: newAlertCondition,
      });
      setAlertFeedback({
        type: "success",
        message: "Price alert created successfully.",
      });
      void loadAlerts();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      setAlertFeedback({
        type: "error",
        message: detail ?? "Failed to create alert.",
      });
    }
  };

  const handleDeleteAlert = async (alertId: number) => {
    try {
      await api.delete(`/alerts/${alertId}`);
      void loadAlerts();
    } catch {
      setAlertsError("Could not delete the alert. Please try again.");
    }
  };

  const fieldClass =
    "w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-2";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your profile settings, account security, and alert rules.
        </p>
      </div>

      {/* Profile update */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-username" className={labelClass}>
                Username
              </label>
              <input
                id="profile-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={4}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="profile-email" className={labelClass}>
                Email
              </label>
              <input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={fieldClass}
              />
            </div>
          </div>

          {profileFeedback && (
            <div
              className={cn(
                "text-sm rounded-lg px-3 py-2",
                profileFeedback.type === "success"
                  ? "bg-green-600/10 text-green-500"
                  : "bg-red-600/10 text-red-500"
              )}
            >
              {profileFeedback.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={submittingProfile}
            className="font-bold"
          >
            {submittingProfile ? "Saving..." : "Save Profile"}
          </Button>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Change Password
        </h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
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

          {passwordFeedback && (
            <div
              className={cn(
                "text-sm rounded-lg px-3 py-2",
                passwordFeedback.type === "success"
                  ? "bg-green-600/10 text-green-500"
                  : "bg-red-600/10 text-red-500"
              )}
            >
              {passwordFeedback.message}
            </div>
          )}

          <Button
            type="submit"
            disabled={submittingPassword}
            className="font-bold"
          >
            {submittingPassword ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </div>

      {/* Alerts management */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">Price Alerts</h2>
            <p className="text-sm text-muted-foreground">
              Manage alert rules that trigger when market prices cross your targets.
            </p>
          </div>
          <Button onClick={() => void loadAlerts()} disabled={alertsLoading}>
            Refresh Alerts
          </Button>
        </div>

        <form onSubmit={handleCreateAlert} className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Asset</label>
            <select
              value={newAlertAsset}
              onChange={(e) => setNewAlertAsset(e.target.value)}
              className={fieldClass}
            >
              <option value="BTC">BTC</option>
              <option value="ETH">ETH</option>
              <option value="AAPL">AAPL</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Target Price</label>
            <input
              type="number"
              value={newAlertTarget}
              onChange={(e) => setNewAlertTarget(Number(e.target.value))}
              min={0.01}
              step={0.01}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Condition</label>
            <select
              value={newAlertCondition}
              onChange={(e) => setNewAlertCondition(e.target.value as AlertCondition)}
              className={fieldClass}
            >
              <option value={AlertCondition.ABOVE}>Above</option>
              <option value={AlertCondition.BELOW}>Below</option>
            </select>
          </div>
          <div className="sm:col-span-3 flex items-center gap-3">
            <Button type="submit" className="font-bold">
              Create Alert
            </Button>
            {alertFeedback && (
              <div
                className={cn(
                  "text-sm rounded-lg px-3 py-2",
                  alertFeedback.type === "success"
                    ? "bg-green-600/10 text-green-500"
                    : "bg-red-600/10 text-red-500"
                )}
              >
                {alertFeedback.message}
              </div>
            )}
          </div>
        </form>

        {alertsError && (
          <div className="text-sm text-red-500 mb-4">{alertsError}</div>
        )}

        {alertsLoading ? (
          <div className="text-sm text-muted-foreground">Loading alerts...</div>
        ) : alerts.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No active alerts. Create one above to start monitoring prices.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4">Condition</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 text-foreground">{alert.asset_symbol}</td>
                    <td className="py-3 pr-4 text-foreground">{alert.condition}</td>
                    <td className="py-3 pr-4 text-foreground">{alert.target_price.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(alert.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4">
                      <Button
                        variant="ghost"
                        onClick={() => void handleDeleteAlert(alert.id)}
                        className="text-sm px-3 py-2"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
