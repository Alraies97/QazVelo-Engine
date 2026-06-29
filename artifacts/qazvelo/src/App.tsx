import * as React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AuthScreen } from "@/components/AuthScreen";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { MarketOverview } from "@/components/MarketOverview";
import { BuySellCard } from "@/components/BuySellCard";
import { AnalyticsView } from "@/components/AnalyticsView";
import { WalletView } from "@/components/WalletView";
import { SettingsView } from "@/components/SettingsView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/sonner";

function SkeletonDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="h-8 w-48 rounded-md bg-muted animate-pulse" />
        <div className="h-72 rounded-xl bg-muted animate-pulse" />
      </div>
      <div className="lg:col-span-1 space-y-4">
        <div className="h-8 w-32 rounded-md bg-muted animate-pulse" />
        <div className="h-96 rounded-xl bg-muted animate-pulse" />
      </div>
    </div>
  );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Initializing session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ErrorBoundary label="Market Overview">
          <MarketOverview />
        </ErrorBoundary>
      </div>
      <div className="lg:col-span-1">
        <ErrorBoundary label="Trading Panel">
          <BuySellCard />
        </ErrorBoundary>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-terminal-data text-cyan mb-2">404</h1>
        <p className="text-muted-foreground">Page not found.</p>
        <a href="/" className="mt-6 inline-block text-primary text-sm hover:underline">Return to Dashboard</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <DashboardLayout>
          <React.Suspense fallback={<SkeletonDashboard />}>
            <DashboardPage />
          </React.Suspense>
        </DashboardLayout>
      </Route>
      <Route path="/analytics">
        <DashboardLayout>
          <React.Suspense fallback={<SkeletonDashboard />}>
            <ErrorBoundary label="Analytics">
              <AnalyticsView />
            </ErrorBoundary>
          </React.Suspense>
        </DashboardLayout>
      </Route>
      <Route path="/wallet">
        <DashboardLayout>
          <React.Suspense fallback={<SkeletonDashboard />}>
            <ErrorBoundary label="Wallet">
              <WalletView />
            </ErrorBoundary>
          </React.Suspense>
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <React.Suspense fallback={<SkeletonDashboard />}>
            <ErrorBoundary label="Settings">
              <SettingsView />
            </ErrorBoundary>
          </React.Suspense>
        </DashboardLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <Toaster position="bottom-right" richColors />
        </WouterRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
