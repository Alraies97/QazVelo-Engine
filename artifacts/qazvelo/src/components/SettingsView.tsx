import * as React from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AlertCondition } from "@/lib/types";
import type { PriceAlert } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsView() {
  const { user, updateUser } = useAuth();

  const [username, setUsername] = React.useState(user?.username ?? "");
  const [email, setEmail] = React.useState(user?.email ?? "");
  const [oldPassword, setOldPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submittingProfile, setSubmittingProfile] = React.useState(false);
  const [submittingPassword, setSubmittingPassword] = React.useState(false);
  const [alerts, setAlerts] = React.useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = React.useState(true);
  const [alertsError, setAlertsError] = React.useState<string | null>(null);
  const [newAlertAsset, setNewAlertAsset] = React.useState("BTC");
  const [newAlertTarget, setNewAlertTarget] = React.useState(1.0);
  const [newAlertCondition, setNewAlertCondition] = React.useState<AlertCondition>(AlertCondition.ABOVE);

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
      console.error("loadAlerts failed", err);
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
    setSubmittingProfile(true);
    try {
      const updated = await updateUser({ username, email });
      toast.success(`Profile updated for ${updated.username}`);
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail ?? "Could not update your profile.");
    } finally {
      setSubmittingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    setSubmittingPassword(true);
    try {
      await api.post("/users/change-password", { old_password: oldPassword, new_password: newPassword });
      toast.success("Password updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail ?? "Could not update password.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post<PriceAlert>("/alerts", {
        asset_symbol: newAlertAsset,
        target_price: newAlertTarget,
        condition: newAlertCondition,
      });
      toast.success("Price alert created successfully.");
      void loadAlerts();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      toast.error(detail ?? "Failed to create alert.");
    }
  };

  const handleDeleteAlert = async (alertId: number) => {
    try {
      await api.delete(`/alerts/${alertId}`);
      void loadAlerts();
      toast.success("Alert removed.");
    } catch {
      toast.error("Could not delete the alert. Please try again.");
    }
  };

  const fieldClass = "w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all";
  const labelClass = "block text-sm font-medium text-muted-foreground mb-2";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Your profile settings, account security, and alert rules.</p>
      </div>

      <div className="glass terminal-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Profile</h2>
        <form onSubmit={handleProfileSave} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-username" className={labelClass}>Username</label>
              <input id="profile-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={4} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="profile-email" className={labelClass}>Email</label>
              <input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={fieldClass} />
            </div>
          </div>
          <button
            type="submit"
            disabled={submittingProfile}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-bold transition-all disabled:opacity-50"
          >
            {submittingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>

      <div className="glass terminal-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
          <div>
            <label htmlFor="old-password" className={labelClass}>Current Password</label>
            <input id="old-password" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" required minLength={8} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="new-password" className={labelClass}>New Password</label>
            <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="confirm-new-password" className={labelClass}>Confirm New Password</label>
            <input id="confirm-new-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} className={fieldClass} />
          </div>
          <button
            type="submit"
            disabled={submittingPassword}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-bold transition-all disabled:opacity-50"
          >
            {submittingPassword ? "Saving..." : "Update Password"}
          </button>
        </form>
      </div>

      <div className="glass terminal-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">Price Alerts</h2>
        <form onSubmit={handleCreateAlert} className="space-y-4 max-w-3xl mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Asset</label>
              <select value={newAlertAsset} onChange={(e) => setNewAlertAsset(e.target.value)} className={fieldClass}>
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="AAPL">AAPL</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Target Price</label>
              <input type="number" step="0.01" value={newAlertTarget} onChange={(e) => setNewAlertTarget(Number(e.target.value))} required min={0.01} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Condition</label>
              <select value={newAlertCondition} onChange={(e) => setNewAlertCondition(e.target.value as AlertCondition)} className={fieldClass}>
                <option value={AlertCondition.ABOVE}>Above</option>
                <option value={AlertCondition.BELOW}>Below</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-primary hover:bg-primary/80 text-primary-foreground text-sm font-bold transition-all"
          >
            Create Alert
          </button>
        </form>

        {alertsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-full rounded" />
            <Skeleton className="h-5 w-full rounded" />
          </div>
        ) : alertsError ? (
          <p className="text-sm text-danger">{alertsError}</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active alerts.</p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-background/50">
                <span className="text-sm text-foreground">
                  <span className="font-semibold">{alert.asset_symbol}</span>{" "}
                  <span className={cn("font-medium", alert.condition === "above" ? "text-success" : "text-danger")}>{alert.condition}</span>{" "}
                  <span className="text-terminal-data font-mono">${alert.target_price}</span>
                </span>
                <button
                  className="text-sm text-destructive hover:bg-destructive/10 px-2 py-1 rounded transition-all"
                  onClick={() => void handleDeleteAlert(alert.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
