import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { acceptInvite } from "@/lib/perfis.functions";
import { supabase } from "@/integrations/supabase/client";
import { kalineApple } from "@/lib/brand-assets";
import { kalineWordmark } from "@/lib/brand-assets";

export const Route = createFileRoute("/convite")({
  component: ConvitePage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
});

function useConviteSearch() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  return { token: params.get("token") ?? "" };
}

function ConvitePage() {
  const { token } = useConviteSearch();
  const accept = useServerFn(acceptInvite);
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "accepted" | "error">("validating");
  const [message, setMessage] = useState("Validando seu convite…");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Link inválido. O token de convite está faltando.");
      return;
    }

    void (async () => {
      // Primeiro garante que o usuário está logado
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setMessage("Você precisa fazer login primeiro. Redirecionando…");
        // Redireciona para auth com redirect de volta
        await navigate({ to: "/auth" });
        return;
      }

      try {
        const result = await accept({ data: { token } });
        setStatus("accepted");
        setMessage("Convite aceito! Redirecionando para seu ambiente…");

        // Determina a rota baseada nos módulos
        const modules = result.modules as string[];
        let redirectTo = "/chat";
        if (modules.includes("kuanyin")) redirectTo = "/kuan-yin";
        else if (modules.includes("kharis")) redirectTo = "/kharis";

        setTimeout(() => {
          window.location.href = redirectTo;
        }, 1500);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Erro ao aceitar convite.");
      }
    })();
  }, [token, accept, navigate]);

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4">
        <img src={kalineApple.url} alt="K∧LINE" className="mx-auto h-20 w-20 apple-glow" />
        <img src={kalineWordmark.url} alt="K∧LINE" className="mx-auto mt-2 h-6 w-auto" />

        {status === "validating" && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--ivory-dim)] border-t-[color:var(--gold)]"
                aria-hidden
              />
            </div>
            <p className="text-sm text-[color:var(--ivory-dim)]">{message}</p>
          </div>
        )}

        {status === "accepted" && (
          <div className="space-y-3">
            <div className="text-4xl">✓</div>
            <p className="text-sm text-[color:var(--ivory)]">{message}</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-sm text-red-400">{message}</p>
            <a
              href="/auth"
              className="inline-block text-xs text-[color:var(--gold)] hover:underline"
            >
              Voltar ao login
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
