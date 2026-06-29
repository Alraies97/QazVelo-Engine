import * as React from "react";
import { TriangleAlert as AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: React.ReactNode;
  label: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="m-6 p-6 rounded-xl border border-destructive/20 bg-destructive/5 text-center space-y-3">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <div className="text-sm font-semibold text-destructive">Something went wrong in {this.props.label}</div>
          <p className="text-xs text-muted-foreground">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="gap-2"
          >
            <RotateCcw size={14} />
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
