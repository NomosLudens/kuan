// Semáforo de Presença — governador de regime da Kaline.
// Quatro estados (verde/amarelo/azul/vermelho) que modulam ritmo, densidade
// e iniciativa da Kaline AGORA. Não é diagnóstico, não vira memória.

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PRESENCA_META, usePresencaRegime, type PresencaState } from "@/lib/use-presenca-regime";

const ORDER: PresencaState[] = ["green", "yellow", "blue", "red"];

export function SemaforoPresence({
  compact = false,
  defaultOpen = false,
  forceState,
}: {
  compact?: boolean;
  defaultOpen?: boolean;
  forceState?: PresencaState;
}) {
  const { state, setState, nota, setNota } = usePresencaRegime();
  const [open, setOpen] = useState(defaultOpen);

  const current = forceState ?? state ?? "green";
  const meta = PRESENCA_META[current];

  return (
    <div className="rounded-xl border border-white/5 bg-[#0C0B12]/80 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2"
        aria-expanded={open}
      >
        <span
          className={`w-2 h-2 rounded-full ${meta.dot} ring-2 ${meta.ring} ${meta.glow}`}
          aria-hidden
        />
        <span className="text-[10px] uppercase tracking-[0.22em] text-[#F3EBDD]/55">Semáforo</span>
        <span className="text-[11px] text-[#F3EBDD]/80">{meta.short}</span>
        {nota.trim() && (
          <span className="text-[10px] italic text-[#F3EBDD]/40 truncate max-w-[40%]">
            · {nota}
          </span>
        )}
        <span className="ml-auto text-[#F3EBDD]/40">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {ORDER.map((s) => {
              const m = PRESENCA_META[s];
              const active = s === current;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  className={
                    "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[11px] transition " +
                    (active
                      ? m.chip
                      : "border-white/10 text-[#F3EBDD]/55 hover:text-[#F3EBDD] hover:border-white/25")
                  }
                  aria-pressed={active}
                  title={m.label}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${m.dot} ${m.glow}`} aria-hidden />
                  {m.short}
                </button>
              );
            })}
          </div>

          {!compact && (
            <>
              <input
                type="text"
                value={nota}
                onChange={(e) => setNota(e.target.value.slice(0, 280))}
                placeholder="Algo que a Kaline deve respeitar neste regime, sem virar memória."
                className="w-full bg-transparent border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-[#F3EBDD]/85 placeholder:text-[#F3EBDD]/30 outline-none focus:border-[#C98A65]/60"
                maxLength={280}
              />
              <p className="text-[10px] italic text-[#F3EBDD]/35">
                Regime de presença declarado. Não é diagnóstico. Nota fica só neste dispositivo.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
