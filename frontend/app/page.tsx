import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";

export default function Home() {
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
            <div className="flex justify-center gap-4">
              <Button>Get Started</Button>
              <Button variant="secondary">Learn More</Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
