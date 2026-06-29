import * as React from "react";
import { cn } from "@/lib/utils";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";

export function AuthScreen() {
  const [isLogin, setIsLogin] = React.useState(true);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">QazVelo</h1>
            <p className="text-xs text-muted-foreground">Engine</p>
          </div>
        </div>

        <div className="flex bg-accent rounded-lg p-1 mb-6">
          <button
            type="button"
            onClick={() => setIsLogin(true)}
            className={cn(
              "flex-1 py-2 rounded-md font-semibold text-sm transition-all",
              isLogin
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setIsLogin(false)}
            className={cn(
              "flex-1 py-2 rounded-md font-semibold text-sm transition-all",
              !isLogin
                ? "bg-primary text-primary-foreground shadow-sm"
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
