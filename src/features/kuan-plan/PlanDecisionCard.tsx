import { Button } from "@/components/ui/button";
import type { PlanDecisionStatus } from "@/lib/kuan-plan.transitions";

export function PlanDecisionCard({
  decision,
  onTransition,
  onMilestone,
  onSupersede,
}: {
  decision: any;
  onTransition: (decision: any, next: PlanDecisionStatus) => void;
  onMilestone: (decision: any) => void;
  onSupersede: (decision: any) => void;
}) {
  const status = decision.status as PlanDecisionStatus;
  return (
    <article className="rounded-2xl border border-pink-500/20 bg-black/25 p-4 shadow-lg shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[color:var(--ivory)]">{decision.title}</h3>
          <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[color:var(--ivory-dim)]">
            {decision.decision_type} · {decision.priority}
          </p>
        </div>
        <span className="rounded-full border border-pink-400/40 px-2 py-1 text-[10px] uppercase text-pink-200">
          {status}
        </span>
      </div>
      <p className="mt-3 text-sm italic text-[color:var(--ivory)]">“{decision.decision_text}”</p>
      {decision.rationale && (
        <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
          <b>Motivo:</b> {decision.rationale}
        </p>
      )}
      {Array.isArray(decision.consequences) && decision.consequences.length > 0 && (
        <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
          <b>Consequências:</b> {decision.consequences.join(" · ")}
        </p>
      )}
      {decision.review_at && (
        <p className="mt-2 text-xs text-[color:var(--ivory-dim)]">
          Revisar em {new Date(decision.review_at).toLocaleDateString("pt-BR")}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {status === "proposed" && (
          <>
            <Button size="sm" onClick={() => onTransition(decision, "accepted")}>
              Aceitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTransition(decision, "rejected")}>
              Rejeitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTransition(decision, "archived")}>
              Arquivar
            </Button>
          </>
        )}
        {status === "accepted" && (
          <>
            <Button size="sm" variant="outline" onClick={() => onTransition(decision, "in_review")}>
              Colocar em revisão
            </Button>
            <Button size="sm" onClick={() => onMilestone(decision)}>
              Transformar em marco
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTransition(decision, "archived")}>
              Arquivar
            </Button>
          </>
        )}
        {status === "in_review" && (
          <>
            <Button size="sm" onClick={() => onTransition(decision, "accepted")}>
              Reaceitar
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTransition(decision, "archived")}>
              Arquivar
            </Button>
          </>
        )}
        {(status === "superseded" || status === "rejected" || status === "archived") && (
          <span className="text-xs text-[color:var(--ivory-dim)]">
            Somente leitura · histórico preservado.
          </span>
        )}
      </div>
    </article>
  );
}
