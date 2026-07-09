import { kalineWordmark } from "@/lib/brand-assets";
import { kalineApple } from "@/lib/brand-assets";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    // Navega para "/" (não /chat): a rota raiz decide o destino certo por
    // faceta/initial_surface, em vez de hardcode aqui.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/" });
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
            src={kalineApple.url}
            alt="Kaline"
            className="mx-auto h-24 w-24 apple-glow sm:h-28 sm:w-28"
          />
          <img src={kalineWordmark.url} alt="K∧LINE" className="mx-auto mt-3 h-7 w-auto sm:h-8" />
          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--ivory-dim)] sm:text-xs">
            Presença que importa
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
