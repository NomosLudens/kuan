import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_AUTHENTICATED_PATH } from "@/lib/identity-routing";

export const Route = createFileRoute("/")({
  // ssr: false — a decisão de destino roda só no cliente, onde a sessão
  // (localStorage) existe. Sem isso, o beforeLoad rodava no servidor e
  // respondia 302 → /auth em TODA abertura (inclusive de usuário logado,
  // já que o servidor nunca vê a sessão), forçando montar a tela de login
  // antes de navegar para o destino real — a principal causa do cold start
  // lento do PWA (start_url "/"). Mesmo padrão de _authenticated/route.tsx.
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });

    throw redirect({ to: DEFAULT_AUTHENTICATED_PATH });
  },
  component: () => null,
});
