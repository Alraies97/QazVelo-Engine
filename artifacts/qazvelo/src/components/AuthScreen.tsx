import * as React from "react";
import { cn } from "@/lib/utils";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";

export function AuthScreen() {
  const [isLogin, setIsLogin] = React.useState(true);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md glass terminal-border rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-cyan">
            <span className="text-primary-foreground font-bold text-lg font-mono">Q</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">QazVelo</h1>
            <p className="text-xs text-muted-foreground font-mono tracking-widest uppercase">Engine</p>
          </div>
        </div>

        <div className="flex bg-secondary rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={cn(
              "flex-1 py-2.5 rounded-md font-semibold text-sm transition-all",
              isLogin
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={cn(
              "flex-1 py-2.5 rounded-md font-semibold text-sm transition-all",
              !isLogin
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Register
          </button>
        </div>

        {isLogin ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}
