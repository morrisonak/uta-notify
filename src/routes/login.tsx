import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Loader2, LogIn, Eye, EyeOff } from "lucide-react";
import { signIn, useSession } from "../lib/auth-client";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { refetch } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await signIn(email, password);
      // Refresh session state before navigating
      await refetch();
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-4">
        {/* Logo / Header */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <AlertTriangle className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">UTA Notify</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Incident Communications Platform
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@uta.org"
                className="w-full h-10 rounded-lg border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full h-10 rounded-lg border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !email || !password}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              Sign In
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground mb-2">Demo Accounts <span className="font-normal">(password: <code className="rounded bg-muted px-1 py-0.5">Demo1234</code>)</span></p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { role: "Admin", email: "admin@uta.org", desc: "Full access" },
              { role: "Editor", email: "editor@uta.org", desc: "Create & edit" },
              { role: "Operator", email: "operator@uta.org", desc: "Manage incidents" },
              { role: "Viewer", email: "viewer@uta.org", desc: "Read only" },
            ].map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword("Demo1234");
                  setError(null);
                }}
                className="rounded-lg border bg-background p-2 text-left text-xs hover:bg-muted transition-colors"
              >
                <span className="font-medium">{account.role}</span>
                <span className="block text-muted-foreground">{account.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          Utah Transit Authority &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
