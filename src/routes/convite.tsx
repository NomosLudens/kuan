import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { checkGuardianInvitation, acceptGuardianInvitation } from "@/lib/perfis.functions";
import { supabase } from "@/integrations/supabase/client";
import { kalineApple, kuanyinApple } from "@/lib/brand-assets";
import { Button } from "@/components/ui/button";

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

type ConviteState =
  | "checking"
  | "invalid"
  | "auth_required"
  | "wrong_email"
  | "expired"
  | "revoked"
  | "already_accepted_by_another_user"
  | "ready_to_accept"
  | "already_accepted_by_me"
  | "accepting"
  | "accepted"
  | "error";

function ConvitePage() {
  const { token } = useConviteSearch();
  const checkInvite = useServerFn(checkGuardianInvitation);
  const acceptInvite = useServerFn(acceptGuardianInvitation);
  const navigate = useNavigate();

  const [state, setState] = useState<ConviteState>("checking");
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("Validando seu convite…");

  const [businessName, setBusinessName] = useState("");
  const [invitedEmailMasked, setInvitedEmailMasked] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isKuanYin, setIsKuanYin] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      setMessage("Link inválido. O token de convite está faltando.");
      return;
    }

    let isMounted = true;

    async function load() {
      try {
        const result = await checkInvite({ data: { token } });
        if (!isMounted) return;

        if (result.status === "invalid") {
          setState("invalid");
          setMessage(result.message || "Convite inválido ou não encontrado.");
          return;
        }

        if (result.status === "auth_required") {
          setState("auth_required");
          return;
        }

        if (result.status === "wrong_email") {
          setState("wrong_email");
          setUserEmail(result.userEmail || "");
          setInvitedEmailMasked(result.invitedEmailMasked || "");
          return;
        }

        if (result.status === "expired") {
          setState("expired");
          return;
        }

        if (result.status === "revoked") {
          setState("revoked");
          return;
        }

        if (result.status === "already_accepted_by_another_user") {
          setState("already_accepted_by_another_user");
          return;
        }

        if (result.status === "success") {
          const invite = result.invite;
          setBusinessName(result.businessName || "Kuan-Yin");
          const modules = (invite?.modules as string[]) || [];
          setIsKuanYin(modules.includes("kuanyin"));

          if (result.alreadyAcceptedByMe) {
            setState("already_accepted_by_me");
          } else {
            setState("ready_to_accept");
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "Erro ao validar convite.");
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [token, checkInvite]);

  const handleSignInRedirect = () => {
    sessionStorage.setItem("authRedirectTo", window.location.pathname + window.location.search);
    void navigate({ to: "/auth" });
  };

  const handleSignOutAndRetry = async () => {
    sessionStorage.setItem("authRedirectTo", window.location.pathname + window.location.search);
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  };

  const handleAccept = async () => {
    setState("accepting");
    setMessage("Aceitando convite e preparando seu ambiente…");
    try {
      const result = await acceptInvite({ data: { token } });
      if ("error" in result && result.error) {
        setState("error");
        setErrorMessage(
          result.error === "wrong_email"
            ? "O e-mail da sessão atual não corresponde ao e-mail convidado."
            : result.error === "expired"
              ? "Este convite expirou."
              : result.error === "revoked"
                ? "Este convite foi revogado."
                : result.error === "already_accepted_by_another_user"
                  ? "Este convite já foi aceito por outra conta."
                  : "Falha ao aceitar convite: " + result.error,
        );
        return;
      }

      setState("accepted");
      setMessage("Convite aceito com sucesso!");

      const modules = (result.modules as string[]) || [];
      let redirectTo = "/chat";
      if (modules.includes("kuanyin")) redirectTo = "/kuan";
      else if (modules.includes("kharis")) redirectTo = "/kharis";

      setTimeout(() => {
        window.location.href = redirectTo;
      }, 1500);
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : "Erro ao aceitar convite.");
    }
  };

  const handleGoToEnvironment = () => {
    let redirectTo = "/chat";
    if (isKuanYin) redirectTo = "/kuan";
    window.location.href = redirectTo;
  };

  const logo = isKuanYin ? kuanyinApple : kalineApple;
  const glowClass = isKuanYin ? "ruby-glow" : "apple-glow";

  return (
    <main className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-card/60 p-6 backdrop-blur sm:p-8 text-center space-y-6">
        <img
          src={logo.url}
          alt={isKuanYin ? "Kuan-Yin" : "Kaline"}
          className={`mx-auto h-24 w-24 sm:h-28 sm:w-28 ${glowClass}`}
        />

        <div className="space-y-2">
          <h1 className="serif text-2xl text-[color:var(--ivory)]">
            {isKuanYin ? "Kuan-Yin" : "Kaline"}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)] sm:text-xs">
            Portal de Convites de Guardião
          </p>
        </div>

        {state === "checking" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--ivory-dim)] border-t-[color:var(--gold)]"
                aria-hidden
              />
            </div>
            <p className="text-sm text-[color:var(--ivory-dim)]">{message}</p>
          </div>
        )}

        {state === "auth_required" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[color:var(--ivory)]">
              Este convite é para Guardião. É necessário fazer login com o e-mail convidado para
              continuar.
            </p>
            <div className="pt-2 space-y-2">
              <Button
                onClick={handleSignInRedirect}
                className="w-full h-11 bg-primary text-primary-foreground"
              >
                Entrar com e-mail convidado
              </Button>
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {state === "wrong_email" && (
          <div className="space-y-4 py-2 text-left">
            <p className="text-sm text-[color:var(--ivory)] text-center font-medium">
              E-mail da sessão atual incompatível
            </p>
            <div className="p-4 rounded-lg bg-black/30 border border-[color:var(--border)] space-y-2 text-xs text-[color:var(--ivory-dim)]">
              <div>
                <span className="font-semibold block text-[color:var(--ivory)]">
                  E-mail conectado:
                </span>
                <span className="font-mono block truncate">{userEmail}</span>
              </div>
              <div className="pt-2 border-t border-[color:var(--border)]/50">
                <span className="font-semibold block text-[color:var(--ivory)]">
                  E-mail do convite:
                </span>
                <span className="font-mono block truncate">{invitedEmailMasked}</span>
              </div>
            </div>
            <p className="text-xs text-center text-[color:var(--ivory-dim)]">
              Para aceitar este convite, saia da conta atual e entre com o e-mail convidado.
            </p>
            <div className="pt-2 space-y-2">
              <Button
                onClick={handleSignOutAndRetry}
                className="w-full h-11 bg-red-600/80 hover:bg-red-700/80 text-white"
              >
                Sair desta conta
              </Button>
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {state === "expired" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-red-400 font-medium">Este convite expirou.</p>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Solicite um novo convite de acesso para o administrador do workspace.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar ao início
              </Button>
            </div>
          </div>
        )}

        {state === "revoked" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-red-400 font-medium">
              Este convite foi revogado ou cancelado.
            </p>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Este token não é mais válido. Entre em contato com o administrador.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar ao início
              </Button>
            </div>
          </div>
        )}

        {state === "already_accepted_by_another_user" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-red-400 font-medium">
              Este convite já foi aceito por outra conta.
            </p>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              Cada link de convite só pode ser utilizado por um único usuário.
            </p>
            <div className="pt-2">
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar ao início
              </Button>
            </div>
          </div>
        )}

        {state === "ready_to_accept" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[color:var(--ivory)]">
              Você foi convidado para atuar como Guardião no workspace de{" "}
              <strong className="text-[color:var(--gold)]">{businessName}</strong>.
            </p>
            <div className="pt-2 space-y-2">
              <Button
                onClick={handleAccept}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold"
              >
                Aceitar convite
              </Button>
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Recusar e Voltar
              </Button>
            </div>
          </div>
        )}

        {state === "already_accepted_by_me" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-[color:var(--ivory)]">
              Você já aceitou o convite para{" "}
              <strong className="text-[color:var(--gold)]">{businessName}</strong>.
            </p>
            <div className="pt-2">
              <Button
                onClick={handleGoToEnvironment}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold"
              >
                Entrar na Kuan-Yin
              </Button>
            </div>
          </div>
        )}

        {state === "accepting" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--ivory-dim)] border-t-[color:var(--gold)]"
                aria-hidden
              />
            </div>
            <p className="text-sm text-[color:var(--ivory)]">{message}</p>
          </div>
        )}

        {state === "accepted" && (
          <div className="space-y-3 py-4">
            <div className="text-4xl text-green-400 font-bold">✓</div>
            <p className="text-sm text-[color:var(--ivory)]">{message}</p>
          </div>
        )}

        {state === "invalid" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-red-400">{message}</p>
            <div className="pt-2">
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar ao início
              </Button>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-red-400 font-medium">Erro ao aceitar convite</p>
            <p className="text-xs text-[color:var(--ivory-dim)]">{errorMessage}</p>
            <div className="pt-2 space-y-2">
              <Button
                onClick={() => setState("ready_to_accept")}
                className="w-full h-11 bg-primary text-primary-foreground"
              >
                Tentar novamente
              </Button>
              <Button
                onClick={() => void navigate({ to: "/" })}
                variant="outline"
                className="w-full h-11"
              >
                Voltar
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
