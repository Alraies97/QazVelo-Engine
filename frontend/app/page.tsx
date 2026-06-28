"use client";

import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { useState } from "react";

export default function Home() {
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkBackend = async () => {
    setLoading(true);
    try {
      const response = await api.get("/");
      setBackendStatus(JSON.stringify(response.data, null, 2));
    } catch (err) {
      setBackendStatus(`Error: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="p-6">
        <div className="container mx-auto max-w-4xl pt-20">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4 text-foreground">
              QazVelo Engine Dashboard
            </h1>
            <p className="text-muted-foreground mb-8">Trading and Analytics Platform</p>
            <div className="flex justify-center gap-4 mb-8">
              <Button onClick={checkBackend} disabled={loading}>
                {loading ? "Checking..." : "Check Backend Connection"}
              </Button>
              <Button variant="secondary">Learn More</Button>
            </div>
            {backendStatus && (
              <div className="mt-8 p-4 bg-card rounded-lg text-left">
                <h3 className="font-semibold mb-2">Backend Status:</h3>
                <pre className="text-sm text-muted-foreground overflow-x-auto">{backendStatus}</pre>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
