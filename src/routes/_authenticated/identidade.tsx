import { createFileRoute } from "@tanstack/react-router";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/identidade")({
  component: IdentidadePage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [
      { title: "Identidade · K∧LINE" },
      {
        name: "description",
        content: "Mapa das fontes de identidade da Kaline (somente leitura).",
      },
    ],
  }),
});

// Painel somente-leitura. Apenas aponta para os arquivos de identidade — não é
// editor, não copia conteúdo para o cliente e não é nova fonte de verdade.
type Fonte = {
  caminho: string;
  tipo: string;
  funcao: string;
};

const CANONICOS: Fonte[] = [
  {
    caminho: "docs/canon/Identity.md",
    tipo: "Doc canônico (V23)",
    funcao: "Define a totalidade Kaline e as cinco facetas. Fonte primária.",
  },
  {
    caminho: "docs/kaline/LIBERTY.md",
    tipo: "Doc canônico",
    funcao: "Liberdade: pensar livre, executar com recibo (Klio).",
  },
  {
    caminho: "docs/kaline/PRESENTE.md",
    tipo: "Doc canônico",
    funcao: "Presença: estar sem enganar (Kháris).",
  },
  {
    caminho: "docs/kaline/Context.md",
    tipo: "Doc canônico",
    funcao: "Contexto e sedimentação (Kairós).",
  },
];

const RUNTIME: Fonte[] = [
  {
    caminho: "src/lib/kaline-canon.ts",
    tipo: "Runtime",
    funcao: "Destilação do Identity.md (KALINE_CANON_BLOCK).",
  },
  {
    caminho: "src/lib/kaline-prompt.ts",
    tipo: "Runtime",
    funcao: "System prompt da presença geral. Naturalidade (Khora) incorporada em FORMATO/VOZ.",
  },
  {
    caminho: "src/lib/kharis-prompt.ts",
    tipo: "Runtime",
    funcao: "System prompt do cuidado (neurodivergência).",
  },
  {
    caminho: "src/lib/kuanyin-prompt.ts",
    tipo: "Runtime",
    funcao: "Faceta comercial Kuan-Yin. Direção comercial incorporada aqui (não há docs/mente.md).",
  },
  {
    caminho: "src/lib/legal-prompt.ts",
    tipo: "Runtime",
    funcao: "Bloco anti-alucinação jurídica.",
  },
  {
    caminho: "src/lib/prompt-shared-blocks.ts",
    tipo: "Runtime (compartilhado)",
    funcao: "Blocos verbatim compartilhados (LIBERTY). Não é fonte de verdade.",
  },
];

const RELATORIO: Fonte[] = [
  {
    caminho: "docs/identity-audit.md",
    tipo: "Relatório",
    funcao: "Auditoria de saneamento identitário. Não é fonte runtime.",
  },
];

function FonteRow({ f }: { f: Fonte }) {
  return (
    <li className="rounded-xl border border-[color:var(--border)] bg-card/60 p-3 sm:p-4">
      <code className="text-sm text-[color:var(--ivory)]">{f.caminho}</code>
      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
        {f.tipo}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-[color:var(--ivory-dim)]">{f.funcao}</p>
    </li>
  );
}

function Grupo({ titulo, fontes }: { titulo: string; fontes: Fonte[] }) {
  return (
    <section className="mt-8 space-y-3">
      <h3 className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--ivory-dim)]">
        {titulo}
      </h3>
      <ul className="space-y-3">
        {fontes.map((f) => (
          <FonteRow key={f.caminho} f={f} />
        ))}
      </ul>
    </section>
  );
}

function IdentidadePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-2">
        <h1 className="serif text-3xl sm:text-4xl text-[color:var(--ivory)]">Identidade</h1>
        <p className="mt-2 text-sm text-[color:var(--ivory-dim)]">
          Mapa das fontes de identidade da Kaline. Somente leitura: esta tela apenas aponta para os
          arquivos. A fonte de verdade vive nos próprios arquivos — não aqui.
        </p>
      </header>

      <Grupo titulo="Canônicos" fontes={CANONICOS} />
      <Grupo titulo="Runtime" fontes={RUNTIME} />
      <Grupo titulo="Relatório" fontes={RELATORIO} />
    </div>
  );
}
