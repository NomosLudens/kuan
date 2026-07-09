import { authedFetch } from "@/lib/authed-fetch";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LazyMarkdown } from "@/components/LazyMarkdown";
import { supabase } from "@/integrations/supabase/client";
import { gerarFichamentoCodice } from "@/lib/codice.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bookmark,
  BookOpen,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  CODICE_BOOKS_BUCKET,
  downloadCodiceEpubBlob,
  isEpubFile,
  removeCodiceEpub,
  uploadCodiceEpub,
} from "@/lib/codice-cloud-library";

type Livro = {
  id: string;
  titulo: string;
  autor: string | null;
  arquivo_path: string | null;
  arquivo_nome: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  texto_extraido: string | null;
  resumo: string | null;
  infografico_url: string | null;
  leitura_percentual: number;
  leitura_posicao: Record<string, unknown> | null;
  ultimo_acesso_em: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ExtractedBook = {
  text: string;
  title?: string;
  author?: string | null;
  chapters?: { id: string; title: string; href?: string; text: string }[];
};

type OpenBook = ExtractedBook & {
  id: string;
  title: string;
  author: string | null;
};

function stripMarkup(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function dirname(path: string) {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx + 1);
}

function resolveZipPath(base: string, href: string) {
  if (!base) return href;
  return href.startsWith(base) ? href : `${base}${href}`.replace(/\/\.\//g, "/");
}

function textFromXml(doc: Document, selector: string) {
  return doc.querySelector(selector)?.textContent?.trim() || undefined;
}

type ZipEntry = {
  dir: boolean;
  name: string;
  async(type: "string"): Promise<string>;
};

type LoadedZip = {
  files: Record<string, ZipEntry>;
};

async function extractEpub(input: File | Blob): Promise<ExtractedBook> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await input.arrayBuffer());
  const parser = new DOMParser();
  const containerRaw = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = containerRaw
    ? parser
        .parseFromString(containerRaw, "application/xml")
        .querySelector("rootfile")
        ?.getAttribute("full-path")
    : undefined;
  const opfRaw = opfPath ? await zip.file(opfPath)?.async("string") : undefined;

  if (!opfPath || !opfRaw) {
    return extractEpubByFilename(zip);
  }

  const opf = parser.parseFromString(opfRaw, "application/xml");
  const base = dirname(opfPath);
  const manifest = new Map<string, { href: string; title: string }>();
  opf.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, { href: resolveZipPath(base, href), title: href });
  });

  const chapters: NonNullable<ExtractedBook["chapters"]> = [];
  for (const itemref of opf.querySelectorAll("spine > itemref")) {
    const idref = itemref.getAttribute("idref");
    const item = idref ? manifest.get(idref) : null;
    if (!item) continue;
    const raw = await zip.file(item.href)?.async("string");
    if (!raw) continue;
    const html = parser.parseFromString(raw, "text/html");
    const title = html.querySelector("h1,h2,h3,title")?.textContent?.trim() || item.title;
    const text = stripMarkup(raw);
    if (text) chapters.push({ id: idref || item.href, title, href: item.href, text });
    if (chapters.map((chapter) => chapter.text).join("\n\n").length > 120000) break;
  }

  const text = chapters
    .map((chapter) => `# ${chapter.title}\n\n${chapter.text}`)
    .join("\n\n")
    .trim();
  if (!text) return extractEpubByFilename(zip);

  return {
    text,
    title: textFromXml(opf, "metadata > title, dc\\:title"),
    author: textFromXml(opf, "metadata > creator, dc\\:creator"),
    chapters,
  };
}

async function extractEpubByFilename(zip: LoadedZip): Promise<ExtractedBook> {
  const entries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.(xhtml|html|htm|xml)$/i.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const chunks: string[] = [];
  for (const entry of entries) {
    const raw = await entry.async("string");
    const text = stripMarkup(raw);
    if (text) chunks.push(text);
    if (chunks.join("\n\n").length > 120000) break;
  }

  const text = chunks.join("\n\n").trim();
  if (!text) throw new Error("Nao consegui extrair texto deste EPUB.");
  return { text };
}

function formatBytes(value: number | null) {
  if (!value) return "tamanho desconhecido";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function LegacyLivrosEngine() {
  const [items, setItems] = useState<Livro[]>([]);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [busy, setBusy] = useState(false);
  const [openBook, setOpenBook] = useState<OpenBook | null>(null);
  const gerarFichamento = useServerFn(gerarFichamentoCodice);

  const openBookPreview = useMemo(() => openBook?.text.slice(0, 24000) ?? "", [openBook]);

  async function load() {
    const { data, error } = await supabase
      .from("livros")
      .select(
        "id, titulo, autor, arquivo_path, arquivo_nome, storage_bucket, storage_path, mime_type, file_size, texto_extraido, resumo, infografico_url, leitura_percentual, leitura_posicao, ultimo_acesso_em, metadata, created_at",
      )
      .eq("storage_bucket", CODICE_BOOKS_BUCKET)
      .order("ultimo_acesso_em", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      return;
    }
    setItems((data ?? []) as Livro[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      if (!isEpubFile(file)) throw new Error("Envie um arquivo EPUB para a Biblioteca Códice.");
      const extracted = await extractEpub(file);
      const finalTitle = titulo.trim() || extracted.title || file.name.replace(/\.[^.]+$/, "");
      const finalAuthor = autor.trim() || extracted.author || null;

      await uploadCodiceEpub(file, {
        title: finalTitle,
        author: finalAuthor,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        metadata: {
          chapter_count: extracted.chapters?.length ?? null,
        },
      });

      setTitulo("");
      setAutor("");
      toast.success("EPUB salvo na Biblioteca Códice.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar EPUB.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function baixarEExtrair(it: Livro) {
    if (!it.storage_path) throw new Error("Este livro ainda nao tem caminho no Storage.");
    const blob = await downloadCodiceEpubBlob(it.storage_path);
    return extractEpub(blob);
  }

  async function abrirLivro(it: Livro) {
    setBusy(true);
    try {
      const extracted = await baixarEExtrair(it);
      setOpenBook({
        ...extracted,
        id: it.id,
        title: extracted.title || it.titulo,
        author: extracted.author || it.autor,
      });
      await supabase
        .from("livros")
        .update({ ultimo_acesso_em: new Date().toISOString() })
        .eq("id", it.id);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao abrir EPUB.");
    } finally {
      setBusy(false);
    }
  }

  async function fazerResumo(it: Livro) {
    setBusy(true);
    try {
      const extracted = openBook?.id === it.id ? openBook : await baixarEExtrair(it);
      await gerarFichamento({
        data: {
          documentId: it.id,
          title: it.titulo,
          text: extracted.text,
        },
      });
      toast.success("Fichamento gerado. Candidatos a memoria ficaram apenas para revisao.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar fichamento.");
    } finally {
      setBusy(false);
    }
  }

  async function salvarProgresso(it: Livro, percentual: number) {
    setBusy(true);
    try {
      const chapterCount = openBook?.id === it.id ? Math.max(openBook.chapters?.length ?? 1, 1) : 1;
      const chapterIndex = Math.min(
        Math.max(Math.floor((percentual / 100) * chapterCount), 0),
        Math.max(chapterCount - 1, 0),
      );
      await supabase
        .from("livros")
        .update({
          leitura_percentual: percentual,
          leitura_posicao: {
            source: "codice-books",
            chapterIndex,
            percent: percentual,
            savedAt: new Date().toISOString(),
          },
          ultimo_acesso_em: new Date().toISOString(),
        })
        .eq("id", it.id);
      toast.success(`Progresso salvo em ${percentual}%`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar progresso.");
    } finally {
      setBusy(false);
    }
  }

  async function gerarInfografico(it: Livro) {
    if (!it.resumo) {
      toast.error("Gere o fichamento primeiro.");
      return;
    }
    setBusy(true);
    try {
      const prompt = `Crie um infografico vertical em estilo limpo e elegante (vinho escuro e dourado, tipografia serifada) ilustrando o seguinte resumo de "${it.titulo}":\n\n${it.resumo.slice(0, 1500)}`;
      const res = await authedFetch("/api/generate-infografico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { image } = (await res.json()) as { image: string | null };
      if (!image) throw new Error("Sem imagem retornada.");

      const blob = await (await fetch(image)).blob();
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Entre novamente para gerar o infografico.");
      const path = `${userRes.user.id}/${crypto.randomUUID()}.png`;
      const up = await supabase.storage
        .from("infograficos")
        .upload(path, blob, { contentType: "image/png" });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage
        .from("infograficos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      await supabase
        .from("livros")
        .update({ infografico_url: signed?.signedUrl ?? null })
        .eq("id", it.id);
      toast.success("Infografico gerado.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar infografico.");
    } finally {
      setBusy(false);
    }
  }

  async function remover(it: Livro) {
    setBusy(true);
    try {
      await removeCodiceEpub(it.storage_path);
      await supabase.from("livros").delete().eq("id", it.id);
      if (openBook?.id === it.id) setOpenBook(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover EPUB.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="serif mb-1 text-2xl text-[color:var(--gold)] sm:text-3xl">
        Biblioteca Códice
      </h1>
      <p className="mb-5 text-sm text-[color:var(--ivory-dim)] sm:mb-6">
        Envie EPUBs para a biblioteca privada. O arquivo fica no Supabase Storage; o banco guarda
        apenas metadados, fichamentos, margens e progresso.
      </p>

      <div className="mb-6 space-y-3 rounded-2xl border border-[color:var(--border)] bg-card p-4 sm:p-5">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Titulo do livro"
          className="h-12 text-base"
        />
        <Input
          value={autor}
          onChange={(e) => setAutor(e.target.value)}
          placeholder="Autor (opcional)"
          className="h-12 text-base"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild disabled={busy} className="h-12 w-full sm:w-auto">
            <label className="cursor-pointer">
              <Upload className="mr-1 h-4 w-4" /> Enviar EPUB
              <input type="file" accept=".epub,application/epub+zip" hidden onChange={onFile} />
            </label>
          </Button>
          {busy && (
            <Loader2 className="h-5 w-5 animate-spin self-center text-[color:var(--gold)]" />
          )}
        </div>
      </div>

      {openBook && (
        <section className="mb-6 rounded-xl border border-[color:var(--border)] bg-card/70 p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase text-[color:var(--gold)]">Leitor EPUB</p>
              <h2 className="serif text-xl text-[color:var(--ivory)]">{openBook.title}</h2>
              {openBook.author && (
                <p className="text-xs text-[color:var(--ivory-dim)]">{openBook.author}</p>
              )}
            </div>
            <p className="text-xs text-[color:var(--ivory-dim)]">
              {openBook.chapters?.length ?? 1} capitulos carregados do Blob temporario
            </p>
          </div>
          <div className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-[color:var(--border)] bg-background p-4 text-sm leading-7 text-[color:var(--ivory)]">
            {openBookPreview}
          </div>
        </section>
      )}

      <h2 className="serif mb-3 text-xl text-[color:var(--ivory)]">Meus EPUBs</h2>
      <ul className="space-y-4">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-xl border border-[color:var(--border)] bg-card/60 p-4 sm:p-5"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h3 className="serif break-words text-lg text-[color:var(--ivory)] sm:text-xl">
                  {it.titulo}
                </h3>
                {it.autor && (
                  <p className="break-words text-xs text-[color:var(--ivory-dim)]">{it.autor}</p>
                )}
                <p className="mt-1 text-xs text-[color:var(--ivory-dim)]">
                  {it.arquivo_nome || "EPUB"} · {formatBytes(it.file_size)}
                </p>
                <p className="mt-1 text-xs text-[color:var(--gold)]">
                  {Math.round(it.leitura_percentual ?? 0)}% lido
                  {it.ultimo_acesso_em
                    ? ` · ultimo acesso ${new Date(it.ultimo_acesso_em).toLocaleDateString("pt-BR")}`
                    : ""}
                </p>
              </div>
              <button
                onClick={() => remover(it)}
                className="shrink-0 p-1 text-[color:var(--ivory-dim)] hover:text-destructive"
                aria-label="Remover"
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => abrirLivro(it)}
                disabled={busy}
                className="h-8"
              >
                <BookOpen className="mr-1 h-3 w-3" /> Abrir
              </Button>
              {[25, 50, 100].map((percentual) => (
                <Button
                  key={percentual}
                  size="sm"
                  variant="outline"
                  onClick={() => salvarProgresso(it, percentual)}
                  disabled={busy}
                  className="h-8"
                >
                  <Bookmark className="mr-1 h-3 w-3" /> {percentual}%
                </Button>
              ))}
            </div>

            {it.resumo ? (
              <div className="prose prose-sm prose-invert mt-3 max-w-none break-words">
                <LazyMarkdown>{it.resumo}</LazyMarkdown>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => fazerResumo(it)}
                disabled={busy}
                className="mt-3 w-full sm:w-auto"
              >
                <Sparkles className="mr-1 h-3 w-3" /> Gerar fichamento
              </Button>
            )}

            {it.infografico_url ? (
              <img src={it.infografico_url} alt="" className="mt-4 w-full max-w-sm rounded-lg" />
            ) : (
              it.resumo && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => gerarInfografico(it)}
                  disabled={busy}
                  className="mt-3 w-full sm:ml-2 sm:w-auto"
                >
                  <ImageIcon className="mr-1 h-3 w-3" /> Gerar infografico
                </Button>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
