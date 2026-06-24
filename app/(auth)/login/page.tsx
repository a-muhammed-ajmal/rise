"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const initialError =
    errorParam === "auth_failed"
      ? "Sign-in failed. Please try again."
      : errorParam === "unauthorized"
        ? "This account isn't authorised. Please sign in with your personal RISE account."
        : null;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser redirects to Google — no further state update needed
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-sm animate-rise-in">
      <Image
        src="/icons/icon-512.png"
        alt="RISE logo"
        width={72}
        height={72}
        className="rounded-2xl shadow-lg"
        priority
      />

      <Card className="w-full glass-surface login-card border-primary/20">
        <CardHeader className="text-center space-y-1 pb-2">
          <CardTitle className="text-2xl font-bold font-heading text-primary">
            RISE
          </CardTitle>
          <CardDescription className="text-sm">
            Your Personal OS
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {error && (
            <p role="alert" className="text-sm text-destructive text-center px-1">
              {error}
            </p>
          )}

          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            aria-busy={loading}
            className="w-full gap-2 min-h-[44px]"
          >
            {loading ? (
              "Redirecting to Google…"
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  focusable="false"
                  className="shrink-0"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Only you can sign in. Your data stays private.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <Suspense
        fallback={
          <div className="w-full max-w-sm h-64 rounded-xl bg-card animate-pulse" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
