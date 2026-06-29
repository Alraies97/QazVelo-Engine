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

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <MarketOverview />
      </div>
      <div className="lg:col-span-1">
        <BuySellCard />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404 — Page Not Found</h1>
        <a href="/" className="mt-4 text-primary underline">Go Home</a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      </Route>
      <Route path="/analytics">
        <DashboardLayout>
          <AnalyticsView />
        </DashboardLayout>
      </Route>
      <Route path="/wallet">
        <DashboardLayout>
          <WalletView />
        </DashboardLayout>
      </Route>
      <Route path="/settings">
        <DashboardLayout>
          <SettingsView />
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
        </WouterRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
