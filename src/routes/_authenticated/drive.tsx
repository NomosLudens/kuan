import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

const ACTIVE_VEHICLE_KEY = "kaline:drive:activeVehicleId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Car,
  Fuel,
  Droplet,
  Receipt,
  Route as RouteIcon,
  FileText,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import {
  listVehicles,
  createVehicle,
  setActiveVehicle,
  deleteVehicle,
  listRefuels,
  createRefuel,
  deleteRefuel,
  listOilChanges,
  createOilChange,
  deleteOilChange,
  listExpenses,
  createExpense,
  deleteExpense,
  listTrips,
  startTrip,
  endTrip,
  deleteTrip,
  listDocs,
  createDoc,
  deleteDoc,
  type Vehicle,
  type Trip,
  type VehicleCreateInput,
  type RefuelCreateInput,
  type OilCreateInput,
  type ExpenseCreateInput,
  type TripStartInput,
  type TripEndInput,
  type DocCreateInput,
} from "@/lib/drive.functions";
import { driveAvatarAsset } from "@/lib/brand-assets";
import { driveAppleAsset } from "@/lib/brand-assets";

import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";

export const Route = createFileRoute("/_authenticated/drive")({
  component: DrivePage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
  head: () => ({
    meta: [
      { title: "Kaline Drive — copiloto veicular" },
      {
        name: "description",
        content: "Carro, combustível, consumo, óleo, despesas, viagens e documentos.",
      },
    ],
  }),
});

type Tab = "painel" | "garagem" | "abastecimentos" | "oleo" | "despesas" | "viagens" | "docs";

const BRL = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : "—";
const fmtDT = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function DrivePage() {
  const [tab, setTab] = useState<Tab>("painel");
  const qc = useQueryClient();
  const listV = useServerFn(listVehicles);
  const setActV = useServerFn(setActiveVehicle);

  const vehiclesQ = useQuery({
    queryKey: ["drive", "vehicles"],
    queryFn: () => listV({ data: undefined } as never),
  });
  const vehicles = useMemo(() => vehiclesQ.data ?? [], [vehiclesQ.data]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACTIVE_VEHICLE_KEY);
  });

  const active = useMemo(() => {
    if (!vehicles.length) return null;
    return (
      (selectedId && vehicles.find((v) => v.id === selectedId)) ||
      vehicles.find((v) => v.ativo) ||
      vehicles[0] ||
      null
    );
  }, [vehicles, selectedId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (active?.id) window.localStorage.setItem(ACTIVE_VEHICLE_KEY, active.id);
  }, [active?.id]);

  const setActM = useMutation({
    mutationFn: (id: string) => setActV({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  const selectVehicle = (id: string) => {
    setSelectedId(id);
    if (typeof window !== "undefined") window.localStorage.setItem(ACTIVE_VEHICLE_KEY, id);
    setActM.mutate(id);
  };

  const tabs: { key: Tab; label: string; icon: typeof Car }[] = [
    { key: "painel", label: "Painel", icon: Car },
    { key: "garagem", label: "Garagem", icon: Car },
    { key: "abastecimentos", label: "Combustível", icon: Fuel },
    { key: "oleo", label: "Óleo", icon: Droplet },
    { key: "despesas", label: "Despesas", icon: Receipt },
    { key: "viagens", label: "Viagens", icon: RouteIcon },
    { key: "docs", label: "Documentos", icon: FileText },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#08080E] text-[#F3EBDD]">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0B0B12]/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-3 sm:px-5 py-2.5 flex items-center gap-2">
          <Link
            to="/home"
            className="p-1.5 rounded-md hover:bg-white/5 text-[#16A34A]"
            aria-label="Voltar"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <img
            src={driveAppleAsset.url}
            alt=""
            className="size-7 rounded-full ring-1 ring-[#16A34A]/40 shadow-[0_0_18px_rgba(22,163,74,0.35)]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#16A34A]">
              Kaline · satélite
            </p>
            <h1 className="serif text-sm sm:text-base leading-tight truncate">
              Drive — copiloto veicular
            </h1>
          </div>
          {vehicles.length > 0 && (
            <select
              value={active?.id ?? ""}
              onChange={(e) => selectVehicle(e.target.value)}
              className="bg-[#08080E] border border-white/10 rounded-md px-2 py-1 text-xs text-[#F3EBDD]"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.apelido}
                </option>
              ))}
            </select>
          )}
        </div>
        <nav className="max-w-5xl mx-auto px-2 sm:px-3 flex gap-1 overflow-x-auto no-scrollbar pb-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition ${
                  on
                    ? "bg-[#16A34A] text-[#08080E] font-medium"
                    : "text-[#F3EBDD]/60 hover:bg-white/5"
                }`}
              >
                <Icon className="size-3.5" />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-5 py-5 pb-24">
        {vehicles.length === 0 && tab !== "garagem" ? (
          <EmptyGarage onGo={() => setTab("garagem")} />
        ) : tab === "painel" ? (
          <Painel vehicleId={active?.id ?? null} />
        ) : tab === "garagem" ? (
          <Garagem vehicles={vehicles} onSetActive={selectVehicle} />
        ) : tab === "abastecimentos" ? (
          <Abastecimentos vehicleId={active!.id} />
        ) : tab === "oleo" ? (
          <Oleo vehicleId={active!.id} />
        ) : tab === "despesas" ? (
          <Despesas vehicleId={active!.id} />
        ) : tab === "viagens" ? (
          <Viagens vehicleId={active!.id} />
        ) : (
          <Docs vehicleId={active!.id} />
        )}
      </main>
    </div>
  );
}

// ============== PAINEL ==============
function Painel({ vehicleId }: { vehicleId: string | null }) {
  const lr = useServerFn(listRefuels);
  const lo = useServerFn(listOilChanges);
  const le = useServerFn(listExpenses);
  const ld = useServerFn(listDocs);

  const refuels = useQuery({
    queryKey: ["drive", "refuels", vehicleId],
    enabled: !!vehicleId,
    queryFn: () => lr({ data: { vehicle_id: vehicleId!, limit: 10 } }),
  });
  const oils = useQuery({
    queryKey: ["drive", "oils", vehicleId],
    enabled: !!vehicleId,
    queryFn: () => lo({ data: { vehicle_id: vehicleId! } }),
  });
  const expenses = useQuery({
    queryKey: ["drive", "expenses", vehicleId],
    enabled: !!vehicleId,
    queryFn: () => le({ data: { vehicle_id: vehicleId!, limit: 100 } }),
  });
  const docs = useQuery({
    queryKey: ["drive", "docs", vehicleId],
    enabled: !!vehicleId,
    queryFn: () => ld({ data: { vehicle_id: vehicleId! } }),
  });

  const consumo = useMemo(() => {
    const list = (refuels.data ?? []).slice().sort((a, b) => a.km - b.km);
    if (list.length < 2) return null;
    const last = list[list.length - 1];
    const prev = list[list.length - 2];
    const dKm = last.km - prev.km;
    if (dKm <= 0 || !Number(last.litros)) return null;
    return dKm / Number(last.litros);
  }, [refuels.data]);

  const kmAtual = useMemo(() => {
    const r = (refuels.data ?? [])[0];
    return r ? r.km : null;
  }, [refuels.data]);

  const oleoRestante = useMemo(() => {
    const o = (oils.data ?? [])[0];
    if (!o || kmAtual == null) return null;
    return o.km + o.durabilidade_km - kmAtual;
  }, [oils.data, kmAtual]);

  const gastoMes = useMemo(() => {
    const now = new Date();
    const m = now.getMonth(),
      y = now.getFullYear();
    const exp = (expenses.data ?? [])
      .filter((e) => {
        const d = new Date(e.ocorrido_em);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((s, e) => s + Number(e.valor || 0), 0);
    const fuel = (refuels.data ?? [])
      .filter((r) => {
        const d = new Date(r.ocorrido_em);
        return d.getMonth() === m && d.getFullYear() === y;
      })
      .reduce((s, r) => s + Number(r.total || 0), 0);
    return exp + fuel;
  }, [expenses.data, refuels.data]);

  const docsVencendo = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 30);
    return (docs.data ?? []).filter((d) => {
      const v = new Date(d.vence_em + "T00:00:00");
      return v <= limit;
    });
  }, [docs.data]);

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[#16A34A]/20 bg-gradient-to-br from-[#062a17] via-[#08080E] to-[#08080E]">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 20% 30%, rgba(22,163,74,0.35), transparent 55%), radial-gradient(circle at 80% 70%, rgba(16,185,129,0.25), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-4 p-4 sm:p-5">
          <img
            src={driveAvatarAsset.url}
            alt="Kaline Drive"
            className="size-20 sm:size-24 rounded-full object-cover ring-2 ring-[#16A34A]/50 shadow-[0_0_30px_rgba(34,197,94,0.45)]"
          />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#16A34A]">
              copiloto veicular
            </p>
            <h2 className="serif text-xl sm:text-2xl leading-tight">Kaline Drive</h2>
            <p className="text-xs text-[#F3EBDD]/60 mt-1 max-w-md">
              Fala rápida do dia do carro vira dado útil — consumo, custo, manutenção, decisão.
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Stat
          label="Consumo"
          value={consumo ? `${consumo.toFixed(1)} km/L` : "—"}
          sub="último intervalo"
        />
        <Stat
          label="Km atual"
          value={kmAtual?.toLocaleString("pt-BR") ?? "—"}
          sub="último abastecimento"
        />
        <Stat
          label="Óleo restante"
          value={oleoRestante != null ? `${oleoRestante.toLocaleString("pt-BR")} km` : "—"}
          sub={
            oleoRestante != null && oleoRestante < 1000 ? "trocar em breve" : "até a próxima troca"
          }
          alert={oleoRestante != null && oleoRestante < 1000}
        />
        <Stat label="Gasto do mês" value={BRL(gastoMes)} sub="combustível + despesas" />
      </div>

      {docsVencendo.length > 0 && (
        <section className="rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5 p-3">
          <div className="flex items-center gap-2 text-[#16A34A] text-xs uppercase tracking-[0.24em] mb-2">
            <AlertTriangle className="size-3.5" /> Documentos vencendo
          </div>
          <ul className="text-sm space-y-1">
            {docsVencendo.map((d) => (
              <li key={d.id} className="flex justify-between">
                <span>{d.tipo}</span>
                <span className="text-[#F3EBDD]/60">{fmtDate(d.vence_em)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section title="Últimos abastecimentos">
        <ul className="divide-y divide-white/5">
          {(refuels.data ?? []).slice(0, 5).map((r) => (
            <li key={r.id} className="py-2 flex justify-between text-sm">
              <span>
                {fmtDate(r.ocorrido_em)} · {Number(r.litros).toFixed(1)} L · {r.combustivel}
              </span>
              <span className="text-[#F3EBDD]/70">
                km {r.km.toLocaleString("pt-BR")} · {BRL(Number(r.total))}
              </span>
            </li>
          ))}
          {(refuels.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>
          )}
        </ul>
      </Section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${alert ? "border-[#16A34A]/50 bg-[#16A34A]/5" : "border-white/10 bg-white/[0.02]"}`}
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#16A34A]">{label}</p>
      <p className="serif text-lg sm:text-xl mt-1">{value}</p>
      {sub && <p className="text-[10px] text-[#F3EBDD]/40 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-[0.24em] text-[#16A34A]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyGarage({ onGo }: { onGo: () => void }) {
  return (
    <div className="text-center py-16 space-y-3">
      <Car className="size-10 mx-auto text-[#16A34A]/60" />
      <p className="serif text-lg">Nenhum veículo cadastrado.</p>
      <p className="text-sm text-[#F3EBDD]/50">
        Cadastre o primeiro para começar a registrar abastecimentos, óleo e despesas.
      </p>
      <button
        onClick={onGo}
        className="mt-2 px-4 py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium"
      >
        Ir para a Garagem
      </button>
    </div>
  );
}

// ============== GARAGEM ==============
function Garagem({
  vehicles,
  onSetActive,
}: {
  vehicles: Vehicle[];
  onSetActive: (id: string) => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createVehicle);
  const del = useServerFn(deleteVehicle);
  const [open, setOpen] = useState(false);

  const createM = useMutation({
    mutationFn: (d: VehicleCreateInput) => create({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Veículo cadastrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      toast.success("Veículo removido");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="serif text-lg">Garagem</h2>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16A34A] text-[#08080E] text-xs font-medium"
        >
          <Plus className="size-3.5" /> Novo veículo
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {vehicles.map((v) => (
          <div
            key={v.id}
            className={`rounded-lg border p-3 ${v.ativo ? "border-[#16A34A]/50 bg-[#16A34A]/5" : "border-white/10 bg-white/[0.02]"}`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="serif text-base">{v.apelido}</p>
                <p className="text-xs text-[#F3EBDD]/60">
                  {[v.modelo, v.ano, v.placa].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              {v.ativo && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#16A34A]/20 text-[#16A34A]">
                  ativo
                </span>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {!v.ativo && (
                <button
                  onClick={() => onSetActive(v.id)}
                  className="text-xs px-2 py-1 rounded border border-white/10 hover:bg-white/5"
                >
                  Ativar
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Remover ${v.apelido}? Isso apaga registros vinculados.`))
                    delM.mutate(v.id);
                }}
                className="text-xs px-2 py-1 rounded border border-red-500/20 text-red-300/80 hover:bg-red-500/5 inline-flex items-center gap-1"
              >
                <Trash2 className="size-3" /> Remover
              </button>
            </div>
          </div>
        ))}
        {vehicles.length === 0 && <p className="text-sm text-[#F3EBDD]/40">Nenhum veículo.</p>}
      </div>

      {open && (
        <Modal title="Novo veículo" onClose={() => setOpen(false)}>
          <VehicleForm onSubmit={(d) => createM.mutate(d)} loading={createM.isPending} />
        </Modal>
      )}
    </div>
  );
}

function VehicleForm({
  onSubmit,
  loading,
}: {
  onSubmit: (d: VehicleCreateInput) => void;
  loading: boolean;
}) {
  const [apelido, setApelido] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [placa, setPlaca] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!apelido.trim()) return;
        onSubmit({
          apelido: apelido.trim(),
          modelo: modelo.trim() || null,
          ano: ano ? Number(ano) : null,
          placa: placa.trim() || null,
        });
      }}
      className="space-y-3"
    >
      <Field label="Apelido *">
        <input
          className={input}
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          required
        />
      </Field>
      <Field label="Modelo">
        <input className={input} value={modelo} onChange={(e) => setModelo(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Ano">
          <input
            type="number"
            className={input}
            value={ano}
            onChange={(e) => setAno(e.target.value)}
          />
        </Field>
        <Field label="Placa">
          <input className={input} value={placa} onChange={(e) => setPlaca(e.target.value)} />
        </Field>
      </div>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Cadastrar"}
      </button>
    </form>
  );
}

// ============== ABASTECIMENTOS ==============
function Abastecimentos({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listRefuels);
  const create = useServerFn(createRefuel);
  const del = useServerFn(deleteRefuel);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["drive", "refuels", vehicleId],
    queryFn: () => list({ data: { vehicle_id: vehicleId, limit: 200 } }),
  });
  const createM = useMutation({
    mutationFn: (d: RefuelCreateInput) => create({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Abastecimento registrado");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <Header title="Abastecimentos" onAdd={() => setOpen(true)} />
      <Section title={`${rows.length} registros`}>
        <ul className="divide-y divide-white/5">
          {rows.map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between text-sm gap-2">
              <div className="min-w-0">
                <p>
                  {Number(r.litros).toFixed(2)} L · {r.combustivel}{" "}
                  {r.preco_litro ? `· R$ ${Number(r.preco_litro).toFixed(3)}/L` : ""}
                </p>
                <p className="text-xs text-[#F3EBDD]/50">
                  {fmtDate(r.ocorrido_em)} · km {r.km.toLocaleString("pt-BR")}{" "}
                  {r.posto ? `· ${r.posto}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm">{BRL(Number(r.total))}</span>
                <button
                  onClick={() => delM.mutate(r.id)}
                  className="p-1 text-red-300/60 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>}
        </ul>
      </Section>

      {open && (
        <Modal title="Novo abastecimento" onClose={() => setOpen(false)}>
          <RefuelForm
            vehicleId={vehicleId}
            onSubmit={(d) => createM.mutate(d)}
            loading={createM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function RefuelForm({
  vehicleId,
  onSubmit,
  loading,
}: {
  vehicleId: string;
  onSubmit: (d: RefuelCreateInput) => void;
  loading: boolean;
}) {
  const [km, setKm] = useState("");
  const [litros, setLitros] = useState("");
  const [combustivel, setCombustivel] = useState<RefuelCreateInput["combustivel"]>("gasolina");
  const [preco, setPreco] = useState("");
  const [posto, setPosto] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          vehicle_id: vehicleId,
          km: Number(km),
          litros: Number(litros),
          combustivel,
          preco_litro: preco ? Number(preco) : null,
          posto: posto || null,
        });
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="Km *">
          <input
            required
            type="number"
            className={input}
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </Field>
        <Field label="Litros *">
          <input
            required
            type="number"
            step="0.01"
            className={input}
            value={litros}
            onChange={(e) => setLitros(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Combustível">
          <select
            className={input}
            value={combustivel}
            onChange={(e) => setCombustivel(e.target.value as RefuelCreateInput["combustivel"])}
          >
            <option value="gasolina">Gasolina</option>
            <option value="alcool">Álcool</option>
            <option value="diesel">Diesel</option>
            <option value="gnv">GNV</option>
            <option value="flex">Flex</option>
          </select>
        </Field>
        <Field label="R$/L">
          <input
            type="number"
            step="0.001"
            className={input}
            value={preco}
            onChange={(e) => setPreco(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Posto">
        <input className={input} value={posto} onChange={(e) => setPosto(e.target.value)} />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Registrar"}
      </button>
    </form>
  );
}

// ============== ÓLEO ==============
function Oleo({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listOilChanges);
  const create = useServerFn(createOilChange);
  const del = useServerFn(deleteOilChange);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["drive", "oils", vehicleId],
    queryFn: () => list({ data: { vehicle_id: vehicleId } }),
  });
  const createM = useMutation({
    mutationFn: (d: OilCreateInput) => create({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Troca registrada");
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  return (
    <div className="space-y-4">
      <Header title="Trocas de óleo" onAdd={() => setOpen(true)} />
      <Section title={`${q.data?.length ?? 0} trocas`}>
        <ul className="divide-y divide-white/5">
          {(q.data ?? []).map((o) => (
            <li key={o.id} className="py-2 flex justify-between text-sm">
              <div>
                <p>
                  km {o.km.toLocaleString("pt-BR")} · dura{" "}
                  {o.durabilidade_km.toLocaleString("pt-BR")} km
                </p>
                <p className="text-xs text-[#F3EBDD]/50">
                  {fmtDate(o.ocorrido_em)} {o.tipo_oleo ? `· ${o.tipo_oleo}` : ""}
                </p>
              </div>
              <button
                onClick={() => delM.mutate(o.id)}
                className="p-1 text-red-300/60 hover:text-red-300"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
          {(q.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>
          )}
        </ul>
      </Section>
      {open && (
        <Modal title="Troca de óleo" onClose={() => setOpen(false)}>
          <OilForm
            vehicleId={vehicleId}
            onSubmit={(d) => createM.mutate(d)}
            loading={createM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
function OilForm({
  vehicleId,
  onSubmit,
  loading,
}: {
  vehicleId: string;
  onSubmit: (d: OilCreateInput) => void;
  loading: boolean;
}) {
  const [km, setKm] = useState("");
  const [dura, setDura] = useState("10000");
  const [tipo, setTipo] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          vehicle_id: vehicleId,
          km: Number(km),
          durabilidade_km: Number(dura),
          tipo_oleo: tipo || null,
        });
      }}
      className="space-y-3"
    >
      <Field label="Km da troca *">
        <input
          required
          type="number"
          className={input}
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </Field>
      <Field label="Durabilidade (km) *">
        <input
          required
          type="number"
          className={input}
          value={dura}
          onChange={(e) => setDura(e.target.value)}
        />
      </Field>
      <Field label="Tipo do óleo">
        <input
          className={input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          placeholder="5W30 sintético, etc."
        />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Registrar"}
      </button>
    </form>
  );
}

// ============== DESPESAS ==============
function Despesas({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listExpenses);
  const create = useServerFn(createExpense);
  const del = useServerFn(deleteExpense);
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["drive", "expenses", vehicleId],
    queryFn: () => list({ data: { vehicle_id: vehicleId, limit: 200 } }),
  });
  const createM = useMutation({
    mutationFn: (d: ExpenseCreateInput) => create({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Despesa registrada");
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  return (
    <div className="space-y-4">
      <Header title="Despesas" onAdd={() => setOpen(true)} />
      <Section title={`${q.data?.length ?? 0} registros`}>
        <ul className="divide-y divide-white/5">
          {(q.data ?? []).map((e) => (
            <li key={e.id} className="py-2 flex justify-between text-sm">
              <div>
                <p>
                  {e.categoria}
                  {e.descricao ? ` · ${e.descricao}` : ""}
                </p>
                <p className="text-xs text-[#F3EBDD]/50">{fmtDate(e.ocorrido_em)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span>{BRL(Number(e.valor))}</span>
                <button
                  onClick={() => delM.mutate(e.id)}
                  className="p-1 text-red-300/60 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
          {(q.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>
          )}
        </ul>
      </Section>
      {open && (
        <Modal title="Nova despesa" onClose={() => setOpen(false)}>
          <ExpenseForm
            vehicleId={vehicleId}
            onSubmit={(d) => createM.mutate(d)}
            loading={createM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
function ExpenseForm({
  vehicleId,
  onSubmit,
  loading,
}: {
  vehicleId: string;
  onSubmit: (d: ExpenseCreateInput) => void;
  loading: boolean;
}) {
  const [cat, setCat] = useState("lavagem");
  const [valor, setValor] = useState("");
  const [desc, setDesc] = useState("");
  const cats = [
    "lavagem",
    "seguro",
    "pedágio",
    "multa",
    "IPVA",
    "licenciamento",
    "mecânico",
    "peças",
    "estacionamento",
    "outro",
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          vehicle_id: vehicleId,
          categoria: cat,
          valor: Number(valor),
          descricao: desc || null,
        });
      }}
      className="space-y-3"
    >
      <Field label="Categoria">
        <select className={input} value={cat} onChange={(e) => setCat(e.target.value)}>
          {cats.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Valor (R$) *">
        <input
          required
          type="number"
          step="0.01"
          className={input}
          value={valor}
          onChange={(e) => setValor(e.target.value)}
        />
      </Field>
      <Field label="Descrição">
        <input className={input} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Salvando..." : "Registrar"}
      </button>
    </form>
  );
}

// ============== VIAGENS ==============
function Viagens({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listTrips);
  const start = useServerFn(startTrip);
  const end = useServerFn(endTrip);
  const del = useServerFn(deleteTrip);
  const [open, setOpen] = useState(false);
  const [endId, setEndId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["drive", "trips", vehicleId],
    queryFn: () => list({ data: { vehicle_id: vehicleId } }),
  });
  const startM = useMutation({
    mutationFn: (d: TripStartInput) => start({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Viagem iniciada");
    },
  });
  const endM = useMutation({
    mutationFn: (d: TripEndInput) => end({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setEndId(null);
      toast.success("Viagem encerrada");
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  const active = (q.data ?? []).find((t) => !t.finalizado_em);
  const endingTrip = endId ? (q.data ?? []).find((t) => t.id === endId) : null;

  return (
    <div className="space-y-4">
      <Header
        title="Viagens"
        onAdd={() => setOpen(true)}
        addLabel={active ? undefined : "Iniciar viagem"}
        disabled={!!active}
      />
      {active && (
        <section className="rounded-lg border border-[#16A34A]/40 bg-[#16A34A]/5 p-3">
          <p className="text-xs uppercase tracking-[0.24em] text-[#16A34A] mb-1">
            Viagem em andamento
          </p>
          <p className="text-sm">
            {active.destino || "sem destino"} · iniciada {fmtDT(active.iniciado_em)} · km inicial{" "}
            {active.km_inicial.toLocaleString("pt-BR")}
          </p>
          <button
            onClick={() => setEndId(active.id)}
            className="mt-2 px-3 py-1.5 text-xs rounded-md bg-[#16A34A] text-[#08080E] font-medium"
          >
            Encerrar
          </button>
        </section>
      )}
      <Section title={`${q.data?.length ?? 0} viagens`}>
        <ul className="divide-y divide-white/5">
          {(q.data ?? [])
            .filter((t) => t.finalizado_em)
            .map((t) => {
              const dist = t.km_final ? t.km_final - t.km_inicial : 0;
              return (
                <li key={t.id} className="py-2 flex justify-between text-sm">
                  <div>
                    <p>
                      {t.destino || "—"} · {dist.toLocaleString("pt-BR")} km
                    </p>
                    <p className="text-xs text-[#F3EBDD]/50">
                      {fmtDT(t.iniciado_em)} → {fmtDT(t.finalizado_em)}{" "}
                      {t.pedagio ? `· pedágio ${BRL(Number(t.pedagio))}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => delM.mutate(t.id)}
                    className="p-1 text-red-300/60 hover:text-red-300"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          {(q.data ?? []).filter((t) => t.finalizado_em).length === 0 && (
            <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>
          )}
        </ul>
      </Section>

      {open && (
        <Modal title="Iniciar viagem" onClose={() => setOpen(false)}>
          <TripStartForm
            vehicleId={vehicleId}
            onSubmit={(d) => startM.mutate(d)}
            loading={startM.isPending}
          />
        </Modal>
      )}
      {endingTrip && (
        <Modal title="Encerrar viagem" onClose={() => setEndId(null)}>
          <TripEndForm
            trip={endingTrip}
            onSubmit={(d) => endM.mutate(d)}
            loading={endM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
function TripStartForm({
  vehicleId,
  onSubmit,
  loading,
}: {
  vehicleId: string;
  onSubmit: (d: TripStartInput) => void;
  loading: boolean;
}) {
  const [destino, setDestino] = useState("");
  const [km, setKm] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ vehicle_id: vehicleId, destino: destino || null, km_inicial: Number(km) });
      }}
      className="space-y-3"
    >
      <Field label="Destino">
        <input className={input} value={destino} onChange={(e) => setDestino(e.target.value)} />
      </Field>
      <Field label="Km inicial *">
        <input
          required
          type="number"
          className={input}
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Iniciar"}
      </button>
    </form>
  );
}
function TripEndForm({
  trip,
  onSubmit,
  loading,
}: {
  trip: Trip;
  onSubmit: (d: TripEndInput) => void;
  loading: boolean;
}) {
  const [km, setKm] = useState("");
  const [pedagio, setPedagio] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ id: trip.id, km_final: Number(km), pedagio: pedagio ? Number(pedagio) : null });
      }}
      className="space-y-3"
    >
      <p className="text-xs text-[#F3EBDD]/60">
        km inicial: {trip.km_inicial.toLocaleString("pt-BR")}
      </p>
      <Field label="Km final *">
        <input
          required
          type="number"
          className={input}
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />
      </Field>
      <Field label="Pedágio (R$)">
        <input
          type="number"
          step="0.01"
          className={input}
          value={pedagio}
          onChange={(e) => setPedagio(e.target.value)}
        />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Encerrar"}
      </button>
    </form>
  );
}

// ============== DOCS ==============
function Docs({ vehicleId }: { vehicleId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listDocs);
  const create = useServerFn(createDoc);
  const del = useServerFn(deleteDoc);
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["drive", "docs", vehicleId],
    queryFn: () => list({ data: { vehicle_id: vehicleId } }),
  });
  const createM = useMutation({
    mutationFn: (d: DocCreateInput) => create({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drive"] });
      setOpen(false);
      toast.success("Documento registrado");
    },
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drive"] }),
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      <Header title="Documentos" onAdd={() => setOpen(true)} />
      <Section title={`${q.data?.length ?? 0} documentos`}>
        <ul className="divide-y divide-white/5">
          {(q.data ?? []).map((d) => {
            const v = new Date(d.vence_em + "T00:00:00");
            const dias = Math.round((v.getTime() - now.getTime()) / 86400000);
            const status = dias < 0 ? "vencido" : dias <= 30 ? "vence em breve" : `em ${dias} dias`;
            const cls =
              dias < 0 ? "text-red-300" : dias <= 30 ? "text-[#16A34A]" : "text-[#F3EBDD]/60";
            return (
              <li key={d.id} className="py-2 flex justify-between text-sm">
                <div>
                  <p>{d.tipo}</p>
                  <p className={`text-xs ${cls}`}>
                    {fmtDate(d.vence_em)} · {status}
                  </p>
                </div>
                <button
                  onClick={() => delM.mutate(d.id)}
                  className="p-1 text-red-300/60 hover:text-red-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
          {(q.data ?? []).length === 0 && (
            <li className="py-3 text-sm text-[#F3EBDD]/40">sem registros</li>
          )}
        </ul>
      </Section>
      {open && (
        <Modal title="Novo documento" onClose={() => setOpen(false)}>
          <DocForm
            vehicleId={vehicleId}
            onSubmit={(d) => createM.mutate(d)}
            loading={createM.isPending}
          />
        </Modal>
      )}
    </div>
  );
}
function DocForm({
  vehicleId,
  onSubmit,
  loading,
}: {
  vehicleId: string;
  onSubmit: (d: DocCreateInput) => void;
  loading: boolean;
}) {
  const [tipo, setTipo] = useState("IPVA");
  const [vence, setVence] = useState("");
  const tipos = ["IPVA", "CNH", "Seguro", "Licenciamento", "Revisão", "Outro"];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ vehicle_id: vehicleId, tipo, vence_em: vence });
      }}
      className="space-y-3"
    >
      <Field label="Tipo">
        <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          {tipos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Vence em *">
        <input
          required
          type="date"
          className={input}
          value={vence}
          onChange={(e) => setVence(e.target.value)}
        />
      </Field>
      <button
        disabled={loading}
        className="w-full py-2 rounded-md bg-[#16A34A] text-[#08080E] text-sm font-medium disabled:opacity-50"
      >
        {loading ? "..." : "Registrar"}
      </button>
    </form>
  );
}

// ============== shared ==============
const input =
  "w-full bg-[#08080E] border border-white/10 rounded-md px-3 py-1.5 text-sm text-[#F3EBDD] outline-none focus:border-[#16A34A]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.22em] text-[#16A34A] mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function Header({
  title,
  onAdd,
  addLabel,
  disabled,
}: {
  title: string;
  onAdd: () => void;
  addLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <h2 className="serif text-lg">{title}</h2>
      <button
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16A34A] text-[#08080E] text-xs font-medium disabled:opacity-40"
      >
        <Plus className="size-3.5" /> {addLabel ?? "Novo"}
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0B0B12] border border-white/10 rounded-t-2xl sm:rounded-lg w-full max-w-md p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="serif text-base">{title}</h3>
          <button onClick={onClose} className="p-1 text-[#F3EBDD]/60 hover:text-[#F3EBDD]">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
