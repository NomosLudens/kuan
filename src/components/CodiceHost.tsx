import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { MicroappHost } from "@/components/microapps/MicroappHost";
import { CODICE_MICROAPP_ACTIONS } from "@/components/microapps/microapp-events";
import type { MicroappEvent } from "@/components/microapps/microapp-types";
import type { Json } from "@/integrations/supabase/types";
import { gerarFichamentoCodice } from "@/lib/codice.functions";
import {
  CODICE_EPUB_MIME,
  deleteCodiceBook,
  listCodiceBooks,
  openCodiceBook,
  saveCodiceMargin,
  updateCodiceBookContent,
  uploadCodiceEpub,
  type CodiceBook,
} from "@/lib/codice-library.functions";

type HostMessage = { source: "kaline-host"; action: string; payload?: unknown; timestamp: number };
type DriveEpubFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

function post(frame: HTMLIFrameElement | null, action: string, payload?: unknown) {
  frame?.contentWindow?.postMessage(
    { source: "kaline-host", action, payload, timestamp: Date.now() } satisfies HostMessage,
    window.location.origin,
  );
}

function payloadRecord(payload: unknown) {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function isFileLike(value: unknown): value is File {
  if (!value || typeof value !== "object") return false;
  const candidate = value as {
    name?: unknown;
    size?: unknown;
    type?: unknown;
    arrayBuffer?: unknown;
  };
  return (
    "name" in candidate &&
    "size" in candidate &&
    "type" in candidate &&
    "arrayBuffer" in candidate &&
    typeof candidate.name === "string" &&
    typeof candidate.size === "number" &&
    typeof candidate.type === "string" &&
    typeof candidate.arrayBuffer === "function"
  );
}

export function CodiceHost() {
  const [lastAction, setLastAction] = useState("Códice pronto para leitura.");
  const [books, setBooks] = useState<CodiceBook[]>([]);
  const currentBlobUrlRef = useRef<string | null>(null);

  const revokeCurrentBlob = useCallback(() => {
    if (currentBlobUrlRef.current) URL.revokeObjectURL(currentBlobUrlRef.current);
    currentBlobUrlRef.current = null;
  }, []);

  useEffect(() => revokeCurrentBlob, [revokeCurrentBlob]);

  const refreshLibrary = useCallback(async (frame: HTMLIFrameElement | null) => {
    const next = await listCodiceBooks();
    setBooks(next);
    post(frame, "codice:library-list-ready", { books: next });
    return next;
  }, []);

  const handleFolder = useCallback(async (folderId: string, frame: HTMLIFrameElement | null) => {
    const { listEpubsInDriveFolder } = await import("@/lib/google-drive.browser");
    post(frame, "codice:drive-loading", {
      message: "Google Drive ainda é experimental. Listando EPUBs...",
    });
    const files = await listEpubsInDriveFolder(folderId);
    post(frame, "codice:drive-epubs", { folderId, files });
    toast.message("Google Drive ainda é experimental. Use Enviar EPUB para Biblioteca Códice.");
  }, []);

  const handleOpenDriveEpub = useCallback(
    async (file: DriveEpubFile, frame: HTMLIFrameElement | null) => {
      const { createEpubBlobUrl, isEpubFile } = await import("@/lib/codice-epub.browser");
      const { downloadDriveFileBlob } = await import("@/lib/google-drive.browser");
      if (!isEpubFile(file.name, file.mimeType)) throw new Error("O Códice aceita apenas EPUB.");
      post(frame, "codice:drive-loading", {
        message: "Google Drive ainda é experimental. Baixando EPUB...",
      });
      const blob = await downloadDriveFileBlob(file.id);
      revokeCurrentBlob();
      currentBlobUrlRef.current = createEpubBlobUrl(blob);
      post(frame, "codice:open-epub", {
        title: file.name.replace(/\.epub$/i, ""),
        fileName: file.name,
        blobUrl: currentBlobUrlRef.current,
        mimeType: CODICE_EPUB_MIME,
      });
      toast.message("Google Drive ainda é experimental. Use Enviar EPUB para Biblioteca Códice.");
    },
    [revokeCurrentBlob],
  );

  const handleCodiceEvent = useCallback(
    (event: MicroappEvent, frame: HTMLIFrameElement | null) => {
      setLastAction(event.action);
      if (event.action === "codice:view-change") return;

      void (async () => {
        try {
          const payload = payloadRecord(event.payload);
          if (event.action === "codice:library-upload-file") {
            const file = payload.file;
            if (!isFileLike(file)) throw new Error("Escolha um arquivo EPUB para enviar.");
            const book = await uploadCodiceEpub(file);
            const next = await refreshLibrary(frame);
            post(frame, "codice:library-book-uploaded", { book });
            post(frame, "codice:library-list-ready", { books: next });
            toast.success("EPUB salvo na Biblioteca Códice.");
            return;
          }
          if (event.action === "codice:library-list-request") {
            await refreshLibrary(frame);
            return;
          }
          if (event.action === "codice:library-open-request") {
            const bookId = String(payload.bookId ?? "");
            if (!bookId) throw new Error("Livro inválido.");
            const { book, blobUrl, blob } = await openCodiceBook(bookId);
            const { extractEpubChapters } = await import("@/lib/codice-epub-text.browser");
            const rendered = await extractEpubChapters(blob);
            await updateCodiceBookContent(book.id, {
              texto_extraido: rendered.text,
              ultimo_acesso_em: new Date().toISOString(),
            });
            revokeCurrentBlob();
            currentBlobUrlRef.current = blobUrl;
            post(frame, "codice:library-book-opened", {
              book,
              blobUrl,
              mimeType: CODICE_EPUB_MIME,
            });
            post(frame, "codice:open-epub", {
              title: book.titulo,
              fileName: book.arquivo_nome,
              blobUrl,
              mimeType: CODICE_EPUB_MIME,
            });
            post(frame, "codice:library-book-render-ready", {
              book,
              blobUrl,
              mimeType: CODICE_EPUB_MIME,
              title: rendered.title ?? book.titulo,
              author: rendered.author,
              text: rendered.text,
              chapters: rendered.chapters,
            });
            await refreshLibrary(frame);
            return;
          }
          if (event.action === "codice:library-delete-request") {
            const bookId = String(payload.bookId ?? "");
            if (!bookId) throw new Error("Livro inválido.");
            await deleteCodiceBook(bookId);
            post(frame, "codice:library-book-deleted", { bookId });
            await refreshLibrary(frame);
            toast.success("Livro apagado da Biblioteca Códice.");
            return;
          }
          if (event.action === "codice:margin-save-request") {
            await saveCodiceMargin({
              livroId: String(payload.livroId ?? ""),
              trecho: payload.trecho as string | undefined,
              nota: String(payload.nota ?? ""),
              localizacao: payload.localizacao as Json | undefined,
              tags: Array.isArray(payload.tags) ? payload.tags.map(String) : [],
            });
            post(frame, "codice:margin-save-complete", { ok: true });
            toast.success("Margem salva no Códice.");
            return;
          }
          if (event.action === "codice:study-generate-request") {
            const bookId = String(payload.bookId ?? "");
            const book =
              books.find((item) => item.id === bookId) ??
              (await listCodiceBooks()).find((item) => item.id === bookId);
            if (!book) throw new Error("Livro não encontrado.");
            let text = book.texto_extraido?.trim() ?? "";
            if (!text) {
              const { blob } = await openCodiceBook(bookId);
              const { extractEpubChapters } = await import("@/lib/codice-epub-text.browser");
              text = (await extractEpubChapters(blob)).text.trim();
            }
            if (!text)
              throw new Error(
                "Fichamento será liberado quando o texto do EPUB puder ser extraído.",
              );
            const { result, markdown } = await gerarFichamentoCodice({
              data: { documentId: bookId, title: book.titulo, text },
            });
            await updateCodiceBookContent(bookId, {
              texto_extraido: text,
              resumo: markdown,
              ultimo_acesso_em: new Date().toISOString(),
            });
            post(frame, "codice:study-generate-complete", { bookId, markdown, result });
            return;
          }
          if (event.action === "codice:drive-folder-url") {
            const { extractDriveFolderId } = await import("@/lib/google-drive.browser");
            const folderId = extractDriveFolderId(String(payload.url ?? ""));
            if (!folderId) throw new Error("Cole uma URL válida de pasta do Google Drive.");
            await handleFolder(folderId, frame);
            return;
          }
          if (event.action === "codice:drive-folder-picker") {
            const { openDriveFolderPicker } = await import("@/lib/google-drive.browser");
            const folder = await openDriveFolderPicker();
            if (folder) await handleFolder(folder.id, frame);
            return;
          }
          if (event.action === "codice:drive-open-epub") {
            await handleOpenDriveEpub(payload.file as DriveEpubFile, frame);
            return;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha no Códice.";
          toast.error(message);
          post(frame, "codice:library-error", { message });
          post(frame, "codice:error", { message });
        }
      })();
    },
    [books, handleFolder, handleOpenDriveEpub, refreshLibrary, revokeCurrentBlob],
  );

  return (
    <>
      <div className="sr-only" aria-live="polite">
        {lastAction}
      </div>
      <MicroappHost
        appId="codice"
        title="Códice"
        expectedSource="codice"
        allowedActions={CODICE_MICROAPP_ACTIONS}
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
        showHeader={false}
        loadingLabel="Abrindo Códice..."
        className="min-h-[calc(100dvh-5.5rem)] bg-transparent p-0 sm:min-h-[calc(100dvh-4rem)]"
        iframeClassName="h-[calc(100dvh-5.5rem)] min-h-[640px] sm:h-[calc(100dvh-4rem)]"
        onEvent={handleCodiceEvent}
      />
    </>
  );
}
