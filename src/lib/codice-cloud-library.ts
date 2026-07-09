import { supabase } from "@/integrations/supabase/client";

export const CODICE_BOOKS_BUCKET = "codice-books";
export const CODICE_EPUB_MIME = "application/epub+zip";

export type CodiceCloudBookMeta = {
  title: string;
  author: string | null;
  fileName: string;
  fileSize: number;
  mimeType: string;
  metadata?: Record<string, unknown>;
};

export function isEpubFile(file: File) {
  return file.name.toLowerCase().endsWith(".epub");
}

export function normalizeEpubMime(file: File) {
  return file.type === CODICE_EPUB_MIME ? file.type : CODICE_EPUB_MIME;
}

export function codiceBookPath(userId: string, bookId: string) {
  return `${userId}/${bookId}.epub`;
}

export async function uploadCodiceEpub(file: File, meta: CodiceCloudBookMeta) {
  if (!isEpubFile(file)) {
    throw new Error("Envie um arquivo EPUB para a Biblioteca Códice.");
  }

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) throw new Error("Entre novamente para enviar o EPUB.");

  const bookId = crypto.randomUUID();
  const path = codiceBookPath(user.id, bookId);
  const mimeType = normalizeEpubMime(file);

  const { error: uploadError } = await supabase.storage
    .from(CODICE_BOOKS_BUCKET)
    .upload(path, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data: created, error: insertError } = await supabase
    .from("livros")
    .insert({
      id: bookId,
      user_id: user.id,
      titulo: meta.title,
      autor: meta.author,
      arquivo_path: `storage:${CODICE_BOOKS_BUCKET}/${path}`,
      texto_extraido: null,
      arquivo_nome: meta.fileName,
      arquivo_mime: mimeType,
      arquivo_ext: "epub",
      arquivo_local_nome: null,
      arquivo_local_mime: null,
      armazenamento_origem: "supabase-storage",
      storage_bucket: CODICE_BOOKS_BUCKET,
      storage_path: path,
      mime_type: mimeType,
      file_size: meta.fileSize,
      origem: "upload",
      leitura_percentual: 0,
      leitura_posicao: { source: "codice-books", section: 0, offset: 0 },
      ultimo_acesso_em: new Date().toISOString(),
      metadata: {
        ...(meta.metadata ?? {}),
        original_name: meta.fileName,
      },
    })
    .select("id")
    .single();

  if (insertError) {
    await supabase.storage.from(CODICE_BOOKS_BUCKET).remove([path]);
    throw insertError;
  }

  return created;
}

export async function downloadCodiceEpubBlob(storagePath: string) {
  const { data: signed, error } = await supabase.storage
    .from(CODICE_BOOKS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  if (!signed?.signedUrl) throw new Error("Não foi possível abrir uma URL temporária para o EPUB.");

  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error("Não foi possível baixar o EPUB privado.");
  return response.blob();
}

export async function removeCodiceEpub(storagePath: string | null) {
  if (!storagePath) return;
  const { error } = await supabase.storage.from(CODICE_BOOKS_BUCKET).remove([storagePath]);
  if (error) throw error;
}
