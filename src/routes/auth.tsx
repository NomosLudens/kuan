import { kuanyinApple } from "@/lib/brand-assets";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

export function getSafeRedirectUrl(url: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // Permit apenas rotas internas (começando com '/' mas não '//' nem '/\')
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.toLowerCase().includes("javascript:") &&
    !trimmed.toLowerCase().includes("http://") &&
    !trimmed.toLowerCase().includes("https://")
  ) {
    return trimmed;
  }
  return null;
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    function handleRedirect() {
      const stored = sessionStorage.getItem("authRedirectTo");
      sessionStorage.removeItem("authRedirectTo"); // Consome imediatamente
      const safe = getSafeRedirectUrl(stored);
      if (safe) {
        // Usa window.location.assign ou navigate. No TanStack router, navigate({ to: safe }) funciona perfeitamente para caminhos relativos
        navigate({ to: safe });
      } else {
        navigate({ to: "/" });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) handleRedirect();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) handleRedirect();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function handleApple() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message || "Erro Apple");
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      toast.error("Digite seu email primeiro.");
      return;
    }
    setResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Link de redefinição enviado para seu email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar link");
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-card/60 p-6 backdrop-blur sm:p-8">
        <div className="mb-6 text-center">
          <img
            src={kuanyinApple.url}
            alt="Kuan-Yin"
            className="mx-auto h-24 w-24 apple-glow sm:h-28 sm:w-28"
          />
          <h1 className="serif mt-3 text-2xl text-[color:var(--ivory)]">Kuan-Yin</h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)] sm:text-xs">
            Presença comercial para Guardiões do Negócio
          </p>
        </div>

        <Button
          onClick={handleApple}
          variant="outline"
          className="mb-4 h-12 w-full"
          disabled={loading}
        >
          Entrar com Apple
        </Button>
        <div className="mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-[color:var(--border)]" />
          <span className="text-xs text-[color:var(--ivory-dim)]">ou</span>
          <div className="h-px flex-1 bg-[color:var(--border)]" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div>
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="auth-password">Senha</Label>
            <Input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-base"
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={loading} aria-busy={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetting}
          className="mt-3 w-full text-center text-xs text-[color:var(--ivory-dim)] hover:text-[color:var(--gold)] disabled:opacity-50"
        >
          {resetting ? "Enviando link..." : "Esqueci minha senha"}
        </button>
      </div>
    </main>
  );
}
