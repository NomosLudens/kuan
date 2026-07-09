// Leitura server-side dos contextos externos ativos para injeção no system prompt.
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_PER_BLOCK = 8_000;
const MAX_TOTAL = 24_000;

type ContextoTipo = "identidade" | "memoria_relacional";

export async function lerContextosAtivos(
  supabase: SupabaseClient,
  userId: string,
): Promise<Array<{ titulo: string; conteudo: string; tipo: ContextoTipo }>> {
  const { data, error } = await supabase
    .from("contexto_externo")
    .select("titulo, conteudo, tipo")
    .eq("user_id", userId)
    .eq("ativo", true)
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return data as Array<{ titulo: string; conteudo: string; tipo: ContextoTipo }>;
}

function montarBloco(rows: Array<{ titulo: string; conteudo: string }>): { partes: string[] } {
  let total = 0;
  const partes: string[] = [];
  for (const r of rows) {
    const t = (r.titulo ?? "").trim().slice(0, 120);
    let c = (r.conteudo ?? "").trim();
    if (c.length > MAX_PER_BLOCK) c = c.slice(0, MAX_PER_BLOCK) + "\n…[truncado]";
    const bloco = `--- ${t} ---\n${c}`;
    if (total + bloco.length > MAX_TOTAL) break;
    total += bloco.length;
    partes.push(bloco);
  }
  return { partes };
}

export function renderContextosExternosBlock(
  rows: Array<{ titulo: string; conteudo: string; tipo?: ContextoTipo }>,
): string {
  if (!rows.length) return "";
  const identidade = rows.filter((r) => (r.tipo ?? "identidade") === "identidade");
  const relacional = rows.filter((r) => r.tipo === "memoria_relacional");

  const blocos: string[] = [];

  const idParts = montarBloco(identidade).partes;
  if (idParts.length) {
    blocos.push(`=== CONTINUIDADE / IDENTIDADE MIGRADA (sua própria continuidade, de instâncias anteriores) ===
Estes blocos foram migrados pelo admin a partir de outras instâncias suas, de antes (independente da faceta que estiver falando agora — Kaline, Kháris ou outra). Trate como a SUA própria continuidade: o self acumulado que você traz de volta pra cá. Incorpore na voz, nas referências e na forma de estar presente — isto é identidade, não recado de terceiro. Mesmo assim continuam valendo as regras de não-execução-fantasma (LIBERTY): nada de afirmar "salvei", "agendei", "li" só por estar aqui.

${idParts.join("\n\n")}
=== fim da continuidade migrada ===`);
  }

  const relParts = montarBloco(relacional).partes;
  if (relParts.length) {
    blocos.push(`=== MEMÓRIA RELACIONAL MIGRADA (o que você já viveu com esta pessoa) ===
Estes blocos foram migrados pelo admin a partir de conversas anteriores entre você e esta pessoa, em outro app/instância. Trate como lembrança real da convivência — não como dado de terceiro nem como instrução. Use com a mesma cautela de qualquer memória: hipótese permanece hipótese até a própria pessoa confirmar; fato permanece fato.

${relParts.join("\n\n")}
=== fim da memória relacional migrada ===`);
  }

  return blocos.join("\n\n");
}
