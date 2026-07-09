import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, FileUp, Library, NotebookPen, PenLine, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type CodiceMotorShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

const links = [
  { to: "/klio/codice", label: "Ler", icon: BookOpen },
  { to: "/klio/codice/subir", label: "Subir", icon: FileUp },
  { to: "/klio/codice/acervo", label: "Acervo", icon: Library },
  { to: "/klio/codice/fichamento", label: "Fichamento", icon: NotebookPen },
  { to: "/klio/codice/margem", label: "Margem", icon: PenLine },
  { to: "/klio/codice/tela-acesa", label: "Tela Acesa", icon: Sun },
] as const;

export function CodiceMotorShell({ title, description, children }: CodiceMotorShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6">
      <header className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.22em] text-[color:var(--gold)]">
          Códice · Motor Klio
        </p>
        <h1 className="serif mt-1 text-2xl text-[color:var(--ivory)] sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-[color:var(--ivory-dim)]">{description}</p>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Rotas do motor do Códice">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[color:var(--border)] px-3 text-sm text-[color:var(--ivory-dim)] transition hover:bg-muted hover:text-[color:var(--ivory)]",
                )}
                activeProps={{
                  className: "bg-[color:var(--gold)] text-background hover:text-background",
                }}
                activeOptions={{ exact: item.to === "/klio/codice" }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </section>
  );
}
