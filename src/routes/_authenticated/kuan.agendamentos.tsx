import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listAppointments,
  cancelAppointment,
  completeAppointment,
  createPortalToken,
  createManualAppointment,
  getBusinessContext,
} from "@/lib/kuanyin.functions";
import { reviewKuanAppointment } from "@/lib/kuanyin-review.functions";
import {
  normalizeAvailabilityRules,
  formatAvailabilitySummary,
} from "@/lib/kuan/availability-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import {
  Calendar,
  User,
  Phone,
  Mail,
  Plus,
  Check,
  X,
  Clock,
  Clipboard,
  Download,
  ExternalLink,
  Filter,
  CheckCircle,
  FileText,
  AlertTriangle,
  Info,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/kuan/agendamentos")({
  component: AgendaPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

type Row = {
  id: string;
  service_name: string;
  starts_at: string;
  ends_at: string | null;
  price_cents: number | null;
  status: "proposed" | "confirmed" | "cancelled" | "completed" | "rejected";
  notes: string | null;
  metadata: any;
  kuanyin_clients: {
    nome: string;
    telefone: string | null;
    email: string | null;
  } | null;
};

function getLocalDateInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const findPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || "0", 10);

  return {
    year: findPart("year"),
    month: findPart("month"),
    day: findPart("day"),
    hour: findPart("hour"),
    minute: findPart("minute"),
    second: findPart("second"),
  };
}

function getStartOfTodayInTimeZone(timeZone: string, baseDate = new Date()): Date {
  const parts = getLocalDateInTimeZone(baseDate, timeZone);
  let utcEstimate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0));
  for (let i = 0; i < 3; i++) {
    const checkParts = getLocalDateInTimeZone(utcEstimate, timeZone);
    const diffHours =
      (parts.year - checkParts.year) * 8760 +
      (parts.month - checkParts.month) * 730 +
      (parts.day - checkParts.day) * 24 +
      (0 - checkParts.hour);
    if (diffHours === 0) break;
    utcEstimate = new Date(utcEstimate.getTime() + diffHours * 60 * 60 * 1000);
  }
  return utcEstimate;
}

type ActiveFilter = "hoje" | "7dias" | "proposed" | "confirmed" | "all";

function AgendaPage() {
  const list = useServerFn(listAppointments);
  const reviewAppt = useServerFn(reviewKuanAppointment);
  const cancel = useServerFn(cancelAppointment);
  const complete = useServerFn(completeAppointment);
  const mkToken = useServerFn(createPortalToken);
  const createManual = useServerFn(createManualAppointment);
  const getContext = useServerFn(getBusinessContext);

  const [rows, setRows] = useState<Row[]>([]);
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formService, setFormService] = useState("");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submittingForm, setSubmittingForm] = useState(false);

  // Portal Share function
  async function share(apptId: string) {
    try {
      const t = (await mkToken({ data: { scope: "appointment", appointment_id: apptId } })) as {
        id: string;
      };
      const url = `${window.location.origin}/portal/${t.id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link do portal do cliente copiado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar link.");
    }
  }

  // Load / Reload
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await list()) as unknown as Row[]);
      const ctx = await getContext();
      setContext(ctx);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar agendamentos.");
    } finally {
      setLoading(false);
    }
  }, [list, getContext]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Submit Manual booking
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formService || !formStartsAt) {
      toast.error("Por favor, preencha nome, serviço e data/hora.");
      return;
    }
    setSubmittingForm(true);
    try {
      await createManual({
        data: {
          client_name: formName,
          client_phone: formPhone || undefined,
          client_email: formEmail || undefined,
          service_name: formService,
          starts_at: formStartsAt,
          notes: formNotes || undefined,
        },
      });
      toast.success("Agendamento criado com status Confirmado!");
      setIsFormOpen(false);
      // Reset form
      setFormName("");
      setFormPhone("");
      setFormEmail("");
      setFormService("");
      setFormStartsAt("");
      setFormNotes("");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao agendar.");
    } finally {
      setSubmittingForm(false);
    }
  };

  // Safe Resolution via reviewKuanAppointment
  const handleReview = async (apptId: string, action: "confirm" | "reject") => {
    try {
      await reviewAppt({ data: { id: apptId, action } });
      toast.success(action === "confirm" ? "Agendamento confirmado!" : "Agendamento rejeitado.");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao processar ação.");
    }
  };

  // Safe Cancel/Complete
  const handleCancel = async (apptId: string) => {
    try {
      await cancel({ data: { id: apptId } });
      toast.success("Agendamento cancelado.");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao cancelar.");
    }
  };

  const handleComplete = async (apptId: string) => {
    try {
      await complete({ data: { id: apptId } });
      toast.success("Agendamento concluído.");
      void reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao concluir.");
    }
  };

  // .ics Export Utility
  function downloadIcs(appt: Row) {
    const startsAt = new Date(appt.starts_at);
    const endsAt = appt.ends_at
      ? new Date(appt.ends_at)
      : new Date(startsAt.getTime() + 60 * 60 * 1000); // 1h default

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };

    const dtStart = formatDate(startsAt);
    const dtEnd = formatDate(endsAt);
    const dtStamp = formatDate(new Date());

    const escapeIcsValue = (val: string) => {
      return val
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
    };

    const clientName = appt.kuanyin_clients?.nome ?? "Cliente";
    const title = escapeIcsValue(`Kuan-Yin · ${appt.service_name} · ${clientName}`);
    const description = appt.notes ? escapeIcsValue(`Observações: ${appt.notes}`) : "";

    const icsLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "PRODID:-//Kuan-Yin Calendar//NONSGML v1.0//PT",
      "BEGIN:VEVENT",
      `UID:${appt.id}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${description}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const icsString = icsLines.join("\r\n");
    const blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStr = startsAt.toISOString().slice(0, 10);
    const safeName = clientName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    link.href = url;
    link.download = `kuan-${dateStr}-${safeName}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Copy Clean text Summary
  function copySummary(appt: Row) {
    const dateStr = new Date(appt.starts_at).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone,
    });
    const clientName = appt.kuanyin_clients?.nome ?? "Não informado";
    const clientPhone = appt.kuanyin_clients?.telefone ?? "Não informado";
    const clientEmail = appt.kuanyin_clients?.email ?? "Não informado";

    const text = `📋 Resumo do Agendamento Kuan-Yin
Serviço: ${appt.service_name}
Data/Hora: ${dateStr}
Cliente: ${clientName}
Contato: Tel: ${clientPhone} | E-mail: ${clientEmail}
Status: ${appt.status.toUpperCase()}
Notas: ${appt.notes ?? "Sem observações"}
Origem: ${appt.metadata?.source === "public_guardian_page" ? "Página Pública" : appt.metadata?.source === "manual_scheduling" ? "Manual" : "Kuan-Yin"}`;

    void navigator.clipboard.writeText(text);
    toast.success("Resumo copiado com sucesso!");
  }

  // --- Filter and Group Logic ---
  const rules = context ? normalizeAvailabilityRules(context.regras_agenda) : null;
  const timeZone = rules?.timezone || "America/Sao_Paulo";

  const todayStart = getStartOfTodayInTimeZone(timeZone);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const next7DaysEnd = new Date(todayStart.getTime() + 8 * 24 * 60 * 60 * 1000);

  // Counters
  const countPending = rows.filter((r) => r.status === "proposed").length;

  const countTodayConfirmed = rows.filter((r) => {
    const d = new Date(r.starts_at);
    return r.status === "confirmed" && d >= todayStart && d < todayEnd;
  }).length;

  const countNext7Days = rows.filter((r) => {
    const d = new Date(r.starts_at);
    return (
      (r.status === "confirmed" || r.status === "proposed") && d >= todayStart && d < next7DaysEnd
    );
  }).length;

  // Filtered Items
  const filteredRows = rows.filter((r) => {
    const d = new Date(r.starts_at);
    if (activeFilter === "hoje") {
      return d >= todayStart && d < todayEnd;
    }
    if (activeFilter === "7dias") {
      return d >= todayStart && d < next7DaysEnd;
    }
    if (activeFilter === "proposed") {
      return r.status === "proposed";
    }
    if (activeFilter === "confirmed") {
      return r.status === "confirmed";
    }
    return true; // "all"
  });

  // Grouping by Date String (YYYY-MM-DD)
  const groupedByDate: { [key: string]: Row[] } = {};
  filteredRows.forEach((r) => {
    const d = new Date(r.starts_at);
    const parts = getLocalDateInTimeZone(d, timeZone);
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
    if (!groupedByDate[dateStr]) {
      groupedByDate[dateStr] = [];
    }
    groupedByDate[dateStr].push(r);
  });

  // Sorted date keys
  const sortedDates = Object.keys(groupedByDate).sort();

  const todayParts = getLocalDateInTimeZone(todayStart, timeZone);
  const tomorrowParts = getLocalDateInTimeZone(
    new Date(todayStart.getTime() + 24 * 60 * 60 * 1000),
    timeZone,
  );
  const padStr = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${todayParts.year}-${padStr(todayParts.month)}-${padStr(todayParts.day)}`;
  const tomorrowStr = `${tomorrowParts.year}-${padStr(tomorrowParts.month)}-${padStr(tomorrowParts.day)}`;

  const getDayLabel = (dateStr: string) => {
    if (dateStr === todayStr) {
      return "Hoje";
    }
    if (dateStr === tomorrowStr) {
      return "Amanhã";
    }

    const [y, m, d] = dateStr.split("-").map(Number);
    const itemDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    return itemDate.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone,
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[color:var(--border)] pb-6">
        <div>
          <h1 className="serif text-3xl font-light tracking-wide text-[color:var(--gold)]">
            Agenda do Guardião
          </h1>
          <p className="text-xs text-[color:var(--ivory-dim)] mt-1 max-w-xl">
            Solicitações e horários confirmados. Nada é confirmado sem revisão humana.
          </p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[color:var(--gold)]/90 hover:bg-[color:var(--gold)] text-black font-semibold rounded-full px-5 transition-all duration-200 shadow-md flex items-center gap-1.5 self-start md:self-auto">
              <Plus className="h-4 w-4" />
              <span>Novo Agendamento</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)] max-w-md">
            <DialogHeader>
              <DialogTitle className="serif text-xl flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[color:var(--gold)]" />
                <span>📅 Agendar Manualmente</span>
              </DialogTitle>
              <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
                Crie um agendamento direto. Ele nascerá como confirmado na Agenda do Guardião.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleManualSubmit} className="space-y-4 mt-3">
              <div className="space-y-1">
                <Label htmlFor="manual-name" className="text-xs text-[color:var(--ivory-dim)]">
                  Nome do Cliente *
                </Label>
                <Input
                  id="manual-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Nome completo do cliente"
                  required
                  className="bg-background/50 border-[color:var(--border)] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manual-phone" className="text-xs text-[color:var(--ivory-dim)]">
                    Telefone
                  </Label>
                  <Input
                    id="manual-phone"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="bg-background/50 border-[color:var(--border)] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-email" className="text-xs text-[color:var(--ivory-dim)]">
                    E-mail
                  </Label>
                  <Input
                    id="manual-email"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="cliente@exemplo.com"
                    className="bg-background/50 border-[color:var(--border)] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="manual-service" className="text-xs text-[color:var(--ivory-dim)]">
                    Serviço / Assunto *
                  </Label>
                  <Input
                    id="manual-service"
                    value={formService}
                    onChange={(e) => setFormService(e.target.value)}
                    placeholder="Ex: Alinhamento, Mentoria"
                    required
                    className="bg-background/50 border-[color:var(--border)] text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="manual-time" className="text-xs text-[color:var(--ivory-dim)]">
                    Data e Hora *
                  </Label>
                  <Input
                    id="manual-time"
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    required
                    className="bg-background/50 border-[color:var(--border)] text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="manual-notes" className="text-xs text-[color:var(--ivory-dim)]">
                  Observações Internas
                </Label>
                <Textarea
                  id="manual-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Instruções adicionais ou contexto sobre o atendimento..."
                  rows={3}
                  className="bg-background/50 border-[color:var(--border)] text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[color:var(--border)]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsFormOpen(false)}
                  disabled={submittingForm}
                  className="text-xs text-[color:var(--ivory-dim)] hover:text-white"
                >
                  Descartar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingForm}
                  className="bg-[color:var(--gold)] hover:bg-[color:var(--gold)]/90 text-black font-semibold text-xs rounded-lg px-4"
                >
                  {submittingForm ? "Salvando…" : "Agendar e Confirmar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Rules Banner */}
      {context && (
        <div className="rounded-xl border border-[color:var(--border)] bg-card/25 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[color:var(--gold)]/10 rounded-lg text-[color:var(--gold)] mt-0.5">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[color:var(--ivory)]">
                Regras Ativas de Disponibilidade
              </h4>
              <p className="text-xs text-[color:var(--ivory-dim)] mt-1">
                {(() => {
                  const rules = normalizeAvailabilityRules(context.regras_agenda);
                  return formatAvailabilitySummary(rules);
                })()}
              </p>
            </div>
          </div>
          <Link
            to="/kuan/config"
            className="text-xs font-semibold text-[color:var(--gold)] hover:underline flex items-center gap-1 shrink-0 md:border-l border-[color:var(--border)] md:pl-4"
          >
            <span>Configurar Regras</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* proposed/Pending Card */}
        <div className="rounded-xl border border-[color:var(--border)] bg-card/25 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[10px] tracking-wider uppercase text-[color:var(--ivory-dim)]">
              Pendentes
            </span>
            <div className="serif text-3xl font-light text-amber-400">{countPending}</div>
          </div>
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Today Confirmed Card */}
        <div className="rounded-xl border border-[color:var(--border)] bg-card/25 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[10px] tracking-wider uppercase text-[color:var(--ivory-dim)]">
              Confirmados Hoje
            </span>
            <div className="serif text-3xl font-light text-[color:var(--gold)]">
              {countTodayConfirmed}
            </div>
          </div>
          <div className="p-2 bg-[color:var(--gold)]/10 rounded-lg text-[color:var(--gold)]">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Next 7 days Card */}
        <div className="rounded-xl border border-[color:var(--border)] bg-card/25 p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[10px] tracking-wider uppercase text-[color:var(--ivory-dim)]">
              Próximos 7 Dias
            </span>
            <div className="serif text-3xl font-light text-[color:var(--ivory)]">
              {countNext7Days}
            </div>
          </div>
          <div className="p-2 bg-white/5 rounded-lg text-[color:var(--ivory-dim)]">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 border-y border-[color:var(--border)]/60 py-3">
        <span className="text-[10px] uppercase text-[color:var(--ivory-dim)] mr-2 flex items-center gap-1 font-medium">
          <Filter className="h-3 w-3" /> Filtrar:
        </span>
        {[
          { id: "all", label: "Todos" },
          { id: "hoje", label: "Hoje" },
          { id: "7dias", label: "Próximos 7 Dias" },
          { id: "proposed", label: `Pendentes (${countPending})` },
          { id: "confirmed", label: "Confirmados" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id as ActiveFilter)}
            className={`text-xs px-3.5 py-1.5 rounded-full border transition-all duration-200 ${
              activeFilter === f.id
                ? "bg-[color:var(--gold)]/15 border-[color:var(--gold)] text-[color:var(--gold)] font-medium"
                : "bg-background/20 border-[color:var(--border)] text-[color:var(--ivory-dim)] hover:text-white hover:border-[color:var(--border)]/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Agenda Items List */}
      <div className="space-y-6">
        {loading && (
          <div className="text-center py-10 space-y-2">
            <p className="text-sm text-[color:var(--ivory-dim)] animate-pulse">
              Carregando agendamentos…
            </p>
          </div>
        )}

        {!loading && sortedDates.length === 0 && (
          <div className="text-center py-12 border border-dashed border-[color:var(--border)] rounded-2xl bg-card/10">
            <Calendar className="h-8 w-8 text-[color:var(--ivory-dim)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[color:var(--ivory-dim)] font-light">
              Nenhum agendamento registrado ainda.
            </p>
          </div>
        )}

        {!loading &&
          sortedDates.map((dateStr) => (
            <div key={dateStr} className="space-y-3">
              {/* Date Header label */}
              <div className="flex items-center gap-2 border-b border-[color:var(--border)]/35 pb-1">
                <h3 className="serif text-xs uppercase tracking-widest text-[color:var(--gold)] font-medium">
                  {getDayLabel(dateStr)}
                </h3>
                <span className="text-[10px] text-[color:var(--ivory-dim)] font-mono">
                  ·{" "}
                  {new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
                    dateStyle: "short",
                  })}
                </span>
              </div>

              {/* Day's appointments */}
              <div className="grid grid-cols-1 gap-3">
                {groupedByDate[dateStr]
                  .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                  .map((appt) => {
                    const client = appt.kuanyin_clients;
                    const isProposed = appt.status === "proposed";
                    const isConfirmed = appt.status === "confirmed";
                    const isCompleted = appt.status === "completed";
                    const isRejected = appt.status === "rejected";
                    const isCancelled = appt.status === "cancelled";

                    // Recover public thread if present in metadata
                    const threadId = appt.metadata?.thread_id || appt.metadata?.threadId;

                    return (
                      <div
                        key={appt.id}
                        className={`rounded-xl border p-4 transition-all duration-200 bg-card/25 hover:bg-card/40 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isProposed
                            ? "border-amber-500/30 bg-amber-500/[0.01] hover:bg-amber-500/[0.03]"
                            : isConfirmed
                              ? "border-[color:var(--border)]"
                              : "border-[color:var(--border)]/30 opacity-60"
                        }`}
                      >
                        {/* Appointment Info column */}
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Time badge */}
                            <div className="flex items-center gap-1 text-sm text-[color:var(--ivory)] font-semibold bg-background/65 px-2 py-0.5 rounded-lg border border-[color:var(--border)]">
                              <Clock className="h-3.5 w-3.5 text-[color:var(--gold)]" />
                              <span>
                                {new Date(appt.starts_at).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone,
                                })}
                              </span>
                            </div>

                            {/* Service title */}
                            <span className="text-sm font-medium text-[color:var(--ivory)] truncate">
                              {appt.service_name}
                            </span>

                            {/* State labels */}
                            <span
                              className={`text-[9px] tracking-wider uppercase font-semibold px-2 py-0.5 rounded-full border ${
                                isProposed
                                  ? "bg-amber-500/10 border-amber-500/35 text-amber-400"
                                  : isConfirmed
                                    ? "bg-[color:var(--gold)]/10 border-[color:var(--gold)]/35 text-[color:var(--gold)]"
                                    : isCompleted
                                      ? "bg-emerald-500/10 border-emerald-500/35 text-emerald-400"
                                      : "bg-white/5 border-white/10 text-[color:var(--ivory-dim)]"
                              }`}
                            >
                              {appt.status === "proposed"
                                ? "pendente"
                                : appt.status === "confirmed"
                                  ? "confirmado"
                                  : appt.status === "completed"
                                    ? "concluído"
                                    : appt.status === "rejected"
                                      ? "rejeitado"
                                      : "cancelado"}
                            </span>

                            {/* Origin badge */}
                            <span className="text-[9px] text-[color:var(--ivory-dim)] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-light">
                              {appt.metadata?.source === "public_guardian_page"
                                ? "Página Pública"
                                : appt.metadata?.source === "manual_scheduling"
                                  ? "Agenda Manual"
                                  : "Kuan-Yin"}
                            </span>
                          </div>

                          {/* Client details */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 text-xs text-[color:var(--ivory-dim)] font-light">
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-[color:var(--gold)] opacity-70" />
                              <span className="font-medium text-[color:var(--ivory)]">
                                {client?.nome ?? "Cliente não informado"}
                              </span>
                            </div>

                            {client?.telefone && (
                              <div className="flex items-center gap-1 hover:text-white transition-colors">
                                <Phone className="h-3 w-3 opacity-60" />
                                <a href={`tel:${client.telefone}`}>{client.telefone}</a>
                              </div>
                            )}

                            {client?.email && (
                              <div className="flex items-center gap-1 hover:text-white transition-colors">
                                <Mail className="h-3 w-3 opacity-60" />
                                <a href={`mailto:${client.email}`}>{client.email}</a>
                              </div>
                            )}
                          </div>

                          {/* Notes */}
                          {appt.notes && (
                            <div className="text-xs text-[color:var(--ivory-dim)] bg-background/20 px-2.5 py-1.5 rounded-lg border border-[color:var(--border)]/45 italic max-w-xl">
                              {appt.notes}
                            </div>
                          )}
                        </div>

                        {/* Actions column */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0 border-t border-[color:var(--border)]/15 pt-3 md:pt-0 md:border-0 justify-end">
                          {/* Propose Review Actions */}
                          {isProposed && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleReview(appt.id, "confirm")}
                                className="bg-emerald-500/90 hover:bg-emerald-500 text-black font-semibold h-8 rounded-lg text-xs flex items-center gap-1"
                              >
                                <Check className="h-3.5 w-3.5" /> Confirmar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReview(appt.id, "reject")}
                                className="border-red-500/40 text-red-400 hover:bg-red-500/10 h-8 rounded-lg text-xs flex items-center gap-1"
                              >
                                <X className="h-3.5 w-3.5" /> Rejeitar
                              </Button>
                            </>
                          )}

                          {/* Confirmed Actions */}
                          {isConfirmed && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleComplete(appt.id)}
                                className="bg-[color:var(--gold)]/80 hover:bg-[color:var(--gold)] text-black font-semibold h-8 rounded-lg text-xs"
                              >
                                Concluir
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel(appt.id)}
                                className="border-[color:var(--border)] text-[color:var(--ivory-dim)] hover:text-white h-8 rounded-lg text-xs"
                              >
                                Cancelar
                              </Button>
                            </>
                          )}

                          {/* Copy Summary helper */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copySummary(appt)}
                            title="Copiar resumo do compromisso"
                            className="h-8 w-8 p-0 text-[color:var(--ivory-dim)] hover:text-white rounded-lg hover:bg-white/5"
                          >
                            <Clipboard className="h-4 w-4" />
                          </Button>

                          {/* Download .ics (iCal) - confirmed only */}
                          {isConfirmed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => downloadIcs(appt)}
                              title="Exportar como arquivo de agenda (.ics)"
                              className="h-8 w-8 p-0 text-[color:var(--ivory-dim)] hover:text-white rounded-lg hover:bg-white/5"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Portal Link (Share) - confirmed only */}
                          {isConfirmed && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => share(appt.id)}
                              title="Copiar link do portal do cliente"
                              className="h-8 w-8 p-0 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/10 rounded-lg"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}

                          {/* Link to Thread if exists */}
                          {threadId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              className="h-8 px-2 text-[color:var(--gold)] hover:bg-[color:var(--gold)]/5 rounded-lg text-xs flex items-center gap-1"
                            >
                              <Link to="/chat/$threadId" params={{ threadId }}>
                                <ExternalLink className="h-3.5 w-3.5" /> Conversa
                              </Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
