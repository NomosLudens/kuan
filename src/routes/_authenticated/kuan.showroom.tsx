import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  ExternalLink,
  MonitorPlay,
  FileCode,
  Upload,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteErrorBoundary, RouteNotFoundBoundary } from "@/components/loading-states";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const SHOWROOM_URL = "/showroom";

export const Route = createFileRoute("/_authenticated/kuan/showroom")({
  component: ShowroomPage,
  errorComponent: RouteErrorBoundary,
  notFoundComponent: () => <RouteNotFoundBoundary />,
});

function ShowroomPage() {
  const [activeTab, setActiveTab] = useState("showroom");

  // Rascunho HTML state & persistence
  const [htmlDraft, setHtmlDraft] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kuan_html_draft") || "";
    }
    return "";
  });

  const [isInsertOpen, setIsInsertOpen] = useState(false);
  const [tempHtml, setTempHtml] = useState("");
  const [previewKey, setPreviewKey] = useState(0); // To force iframe reload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync tempHtml when modal opens
  useEffect(() => {
    if (isInsertOpen) {
      setTempHtml(htmlDraft);
    }
  }, [isInsertOpen, htmlDraft]);

  // Apply drafted HTML
  const handleApplyHtml = () => {
    setHtmlDraft(tempHtml);
    localStorage.setItem("kuan_html_draft", tempHtml);
    setIsInsertOpen(false);
    setPreviewKey((prev) => prev + 1);
  };

  // Direct file import
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || "";
      setHtmlDraft(content);
      localStorage.setItem("kuan_html_draft", content);
      setPreviewKey((prev) => prev + 1);
    };
    reader.readAsText(file);
    // Reset file input value to allow importing the same file again
    e.target.value = "";
  };

  // File import inside modal
  const handleModalFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || "";
      setTempHtml(content);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export HTML as index.html blob
  const handleExportHtml = () => {
    if (!htmlDraft) return;
    const blob = new Blob([htmlDraft], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Refresh preview
  const handleRefreshPreview = () => {
    setPreviewKey((prev) => prev + 1);
  };

  // Clear draft
  const handleClearDraft = () => {
    setHtmlDraft("");
    localStorage.removeItem("kuan_html_draft");
    setPreviewKey((prev) => prev + 1);
  };

  return (
    <section className="h-full min-h-0 bg-background overflow-y-auto">
      <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Main Header Banner */}
        <div className="rounded-2xl border border-[color:var(--border)] bg-card/70 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <div className="mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[color:oklch(0.69_0.22_350/0.35)] bg-[color:oklch(0.69_0.22_350/0.12)] text-[color:oklch(0.86_0.06_350)] shadow-[0_0_15px_rgba(212,175,55,0.1)]">
                <MonitorPlay className="h-6 w-6" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="serif text-2xl sm:text-3xl text-[color:var(--ivory)] font-semibold tracking-tight">
                  Showroom Kuan-Yin
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--ivory-dim)] max-w-2xl">
                  Mostruário vivo da experiência comercial. Explore os fluxos oficiais ou use o
                  rascunho interativo para experimentar novos layouts de páginas públicas.
                </p>
              </div>
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full sm:w-auto shrink-0 transition-all duration-200 hover:border-[color:var(--gold)] hover:text-[color:var(--gold)]"
            >
              <a href={SHOWROOM_URL} target="_blank" rel="noopener noreferrer">
                Abrir em nova aba
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-2">
            <TabsList className="bg-black/40 border border-[color:var(--border)] p-1 rounded-xl">
              <TabsTrigger
                value="showroom"
                className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-[color:var(--gold)] text-xs font-semibold px-4 py-2 cursor-pointer transition-all duration-200"
              >
                🌐 Mostruário Oficial
              </TabsTrigger>
              <TabsTrigger
                value="draft"
                className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-[color:var(--gold)] text-xs font-semibold px-4 py-2 cursor-pointer transition-all duration-200"
              >
                📝 Rascunho HTML
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Showroom Oficial */}
          <TabsContent value="showroom" className="focus-visible:outline-none">
            <div className="relative min-h-[60dvh] flex-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-black p-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <iframe
                title="Showroom Kuan-Yin"
                src={SHOWROOM_URL}
                className="h-full min-h-[60dvh] w-full rounded-xl border-0 bg-white"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="fullscreen"
              />
            </div>
            <p className="mt-3 px-1 text-xs leading-relaxed text-[color:var(--ivory-dim)]">
              Se o navegador, WebView ou as políticas de segurança do site impedirem a incorporação,
              use “Abrir em nova aba” para acessar o showroom diretamente.
            </p>
          </TabsContent>

          {/* Tab 2: Rascunho HTML */}
          <TabsContent value="draft" className="space-y-4 focus-visible:outline-none">
            <div className="rounded-2xl border border-[color:var(--border)] bg-card/65 p-5 shadow-[0_15px_45px_rgba(0,0,0,0.18)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="serif text-xl text-[color:var(--ivory)] font-medium">
                    Rascunho HTML da página pública
                  </h2>
                  <p className="mt-1 text-xs text-[color:var(--ivory-dim)] leading-relaxed max-w-xl">
                    Cole um HTML único para visualizar uma proposta de página do Guardião. Nada será
                    publicado sem revisão.
                  </p>
                </div>

                {/* Control Action Buttons */}
                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    onClick={() => setIsInsertOpen(true)}
                    className="bg-[color:var(--gold)]/90 hover:bg-[color:var(--gold)] text-black font-semibold text-xs rounded-full px-4"
                  >
                    <FileCode className="mr-1.5 h-4 w-4" />
                    Inserir HTML
                  </Button>

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="border-[color:var(--border)] text-[color:var(--ivory)] hover:border-[color:var(--gold)] hover:text-[color:var(--gold)] text-xs rounded-full px-4"
                  >
                    <Upload className="mr-1.5 h-4 w-4" />
                    Importar .html
                  </Button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".html,text/html"
                    onChange={handleFileImport}
                    className="hidden"
                  />

                  <Button
                    onClick={handleRefreshPreview}
                    variant="ghost"
                    className="text-[color:var(--ivory-dim)] hover:text-[color:var(--ivory)] text-xs rounded-full px-3"
                    title="Atualizar preview"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>

                  {htmlDraft && (
                    <>
                      <Button
                        onClick={handleExportHtml}
                        variant="secondary"
                        className="bg-zinc-800 text-white hover:bg-zinc-700 text-xs rounded-full px-4"
                      >
                        <Download className="mr-1.5 h-4 w-4" />
                        Exportar HTML
                      </Button>

                      <Button
                        onClick={handleClearDraft}
                        variant="destructive"
                        className="bg-red-950/40 hover:bg-red-900/60 border border-red-900/50 text-red-200 text-xs rounded-full px-4"
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        Limpar rascunho
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Glowing Gold Warning Banner */}
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--gold)]/25 bg-[color:var(--gold)]/[0.04] p-3 text-[color:var(--gold)] shadow-[0_0_15px_rgba(212,175,55,0.03)]">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed font-medium">
                  Este HTML é um rascunho visual. Ele ainda não está publicado na página pública.
                </div>
              </div>
            </div>

            {/* Preview Iframe sandbox */}
            <div className="relative min-h-[58dvh] rounded-2xl border border-[color:var(--border)] bg-black p-1 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
              <iframe
                key={previewKey}
                title="Rascunho Preview"
                sandbox="allow-scripts"
                srcDoc={
                  htmlDraft ||
                  `<!DOCTYPE html><html><head><style>
                    body {
                      background: #09090b;
                      color: #d4d4d8;
                      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      height: 100vh;
                      margin: 0;
                      text-align: center;
                      padding: 20px;
                      box-sizing: border-box;
                    }
                    .box {
                      border: 1px dashed #3f3f46;
                      padding: 40px;
                      border-radius: 16px;
                      max-width: 450px;
                      background: rgba(255,255,255,0.02);
                      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    }
                    h1 { color: #f4f4f5; font-size: 1.5rem; margin-bottom: 12px; font-weight: 600; }
                    p { font-size: 0.875rem; color: #a1a1aa; line-height: 1.5; margin: 0; }
                    button {
                      margin-top: 20px;
                      background: #d4af37;
                      color: black;
                      border: none;
                      padding: 10px 20px;
                      font-size: 0.825rem;
                      font-weight: 600;
                      border-radius: 9999px;
                      cursor: pointer;
                    }
                  </style></head><body>
                    <div class="box">
                      <h1>Nenhum HTML inserido ainda</h1>
                      <p>Use o botão "Inserir HTML" ou "Importar .html" acima para colar ou carregar um arquivo de proposta visual e testar instantaneamente.</p>
                    </div>
                  </body></html>`
                }
                className="h-full min-h-[58dvh] w-full rounded-xl border-0 bg-zinc-950"
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal Dialog: Inserir HTML */}
      <Dialog open={isInsertOpen} onOpenChange={setIsInsertOpen}>
        <DialogContent className="border-[color:var(--border)] bg-card/95 backdrop-blur-lg text-[color:var(--ivory)] shadow-[0_24px_80px_rgba(0,0,0,0.4)] max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="serif text-xl flex items-center gap-2">
              <FileCode className="h-5 w-5 text-[color:var(--gold)]" />
              Inserir HTML da Página Pública
            </DialogTitle>
            <DialogDescription className="text-[color:var(--ivory-dim)] text-xs">
              Cole o código completo do rascunho visual ou importe um arquivo .html para
              preenchimento automático.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Modal Import option */}
            <div className="flex items-center justify-between border-b border-[color:var(--border)] pb-3">
              <span className="text-xs text-[color:var(--ivory-dim)] font-medium">
                Importar de um arquivo local:
              </span>
              <Label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs py-1.5 px-3 rounded-lg transition-all">
                Escolher Arquivo .html
                <input
                  type="file"
                  accept=".html,text/html"
                  onChange={handleModalFileImport}
                  className="hidden"
                />
              </Label>
            </div>

            {/* Code input text area */}
            <div className="space-y-1.5">
              <Label
                htmlFor="html-content"
                className="text-xs text-[color:var(--ivory-dim)] font-medium"
              >
                Código HTML:
              </Label>
              <Textarea
                id="html-content"
                placeholder="<!DOCTYPE html>&#10;<html>...</html>"
                value={tempHtml}
                onChange={(e) => setTempHtml(e.target.value)}
                className="font-mono text-[11px] leading-relaxed bg-black/60 border-[color:var(--border)] focus:border-[color:var(--gold)] h-[250px] resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-[color:var(--border)]">
            <Button
              onClick={() => setIsInsertOpen(false)}
              variant="ghost"
              className="text-[color:var(--ivory-dim)] hover:text-white text-xs rounded-full"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleApplyHtml}
              className="bg-[color:var(--gold)]/90 hover:bg-[color:var(--gold)] text-black font-semibold text-xs rounded-full px-6"
            >
              Usar este HTML
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
