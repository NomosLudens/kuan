import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default defineConfig({
  server: {
    watch: {
      ignored: ["**/.bun/**", "**/node_modules/**", "**/.cache/**"],
    },
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      server: {
        entry: "server",
      },
      router: {
        // Divide o componente de cada rota em chunk próprio. Sem isso, o glue
        // code das ~50 rotas ia inteiro no chunk principal (~310 KB gzip antes
        // de qualquer interação) — custo de parse/exec pesado no WebKit,
        // principal fator do cold start lento do PWA no iOS.
        // Nota: o gerador do router é o embutido no tanstackStart(); um
        // TanStackRouterVite avulso aqui seria ignorado.
        //
        // Versões diferentes dos tipos do TanStack Start divergem aqui;
        // em runtime, autoCodeSplitting é aceito pelo plugin instalado.
        autoCodeSplitting: true,
      } as never,
    }),
    react(),
  ],
});
