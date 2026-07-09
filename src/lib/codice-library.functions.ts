import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const CODICE_BOOKS_BUCKET = "codice-books";
export const CODICE_EPUB_MIME = "application/epub+zip";
export const CODICE_EPUB_MIME_ALIASES = [CODICE_EPUB_MIME, "application/epub"];
export const CODICE_MAX_EPUB_BYTES = 100 * 1024 * 1024;

export type CodiceBook = {
  id: string;
  titulo: string;
  autor?: string | null;
  arquivo_nome?: string | null;
  arquivo_mime?: string | null;
  arquivo_ext?: string | null;
  arquivo_path?: string | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  armazenamento_origem?: string | null;
  file_size?: number | null;
  texto_extraido?: string | null;
  resumo?: string | null;
  ultimo_acesso_em?: string | null;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
};

type LivroRow = CodiceBook & { user_id: string };

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Entre novamente para usar a Biblioteca Códice.");
  return data.user.id;
}

function isEpub(file: File) {
  return CODICE_EPUB_MIME_ALIASES.includes(file.type) || file.name.toLowerCase().endsWith(".epub");
}

function asBook(row: unknown): CodiceBook {
  return row as CodiceBook;
}

export async function uploadCodiceEpub(file: File): Promise<CodiceBook> {
  if (!isEpub(file)) throw new Error("Envie um arquivo .epub válido.");
  if (file.size > CODICE_MAX_EPUB_BYTES) throw new Error("O EPUB deve ter no máximo 100 MB.");
  const userId = await currentUserId();
  const bookId = crypto.randomUUID();
  const uploadedAt = new Date().toISOString();
  const storagePath = `${userId}/${bookId}.epub`;

  const { error: uploadError } = await supabase.storage
    .from(CODICE_BOOKS_BUCKET)
    .upload(storagePath, file, {
      contentType: CODICE_EPUB_MIME,
      upsert: false,
    });
  if (uploadError) throw new Error(`Não consegui salvar o EPUB no Storage: ${uploadError.message}`);

  const row = {
    id: bookId,
    user_id: userId,
    titulo: file.name.replace(/\.epub$/i, ""),
    arquivo_nome: file.name,
    arquivo_mime: CODICE_EPUB_MIME,
    arquivo_ext: "epub",
    arquivo_path: `storage:${CODICE_BOOKS_BUCKET}/${storagePath}`,
    storage_bucket: CODICE_BOOKS_BUCKET,
    storage_path: storagePath,
    armazenamento_origem: "supabase-storage",
    file_size: file.size,
    ultimo_acesso_em: uploadedAt,
    metadata: { source: "codice-library", uploadedAt, browserMime: file.type || null },
  };

  const { data, error } = await supabase.from("livros").insert(row).select("*").single();
  if (error) {
    const { error: cleanupError } = await supabase.storage
      .from(CODICE_BOOKS_BUCKET)
      .remove([storagePath]);
    throw new Error(
      `Não consegui salvar os metadados do livro: ${error.message}${
        cleanupError ? ` Também não consegui remover o arquivo órfão: ${cleanupError.message}` : ""
      }`,
    );
  }
  return asBook(data);
}

export async function listCodiceBooks(): Promise<CodiceBook[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("livros")
    .select("*")
    .eq("user_id", userId)
    .eq("armazenamento_origem", "supabase-storage")
    .order("ultimo_acesso_em", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Não consegui carregar seus EPUBs: ${error.message}`);
  return (data ?? []).map(asBook);
}

async function getOwnBook(bookId: string): Promise<LivroRow> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("livros")
    .select("*")
    .eq("id", bookId)
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`Não consegui encontrar o livro: ${error.message}`);
  return data as LivroRow;
}

export async function openCodiceBook(
  bookId: string,
): Promise<{ book: CodiceBook; blob: Blob; blobUrl: string }> {
  const book = await getOwnBook(bookId);
  if (!book.storage_path) throw new Error("Este livro não tem arquivo no Storage.");
  const { data, error } = await supabase.storage
    .from(book.storage_bucket ?? CODICE_BOOKS_BUCKET)
    .download(book.storage_path);
  if (error || !data)
    throw new Error(`Não consegui baixar o EPUB privado: ${error?.message ?? "sem blob"}`);
  const ultimo_acesso_em = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("livros")
    .update({ ultimo_acesso_em })
    .eq("id", bookId)
    .eq("user_id", book.user_id);
  if (updateError)
    throw new Error(`Não consegui atualizar o acesso do livro: ${updateError.message}`);
  return { book: { ...book, ultimo_acesso_em }, blob: data, blobUrl: URL.createObjectURL(data) };
}

export async function deleteCodiceBook(bookId: string): Promise<void> {
  const book = await getOwnBook(bookId);
  if (book.storage_path) {
    const { error } = await supabase.storage
      .from(book.storage_bucket ?? CODICE_BOOKS_BUCKET)
      .remove([book.storage_path]);
    if (error) throw new Error(`Não consegui remover o EPUB do Storage: ${error.message}`);
  }
  const { error } = await supabase
    .from("livros")
    .delete()
    .eq("id", bookId)
    .eq("user_id", book.user_id);
  if (error) throw new Error(`Não consegui remover o livro: ${error.message}`);
}

export async function saveCodiceMargin(input: {
  livroId: string;
  trecho?: string;
  nota: string;
  localizacao?: Json;
  tags?: string[];
}): Promise<void> {
  const userId = await currentUserId();
  if (!input.nota.trim()) throw new Error("Escreva uma margem antes de salvar.");
  await getOwnBook(input.livroId);
  const { error } = await supabase.from("codice_margens").insert({
    user_id: userId,
    livro_id: input.livroId,
    trecho: input.trecho ?? null,
    nota: input.nota.trim(),
    localizacao: input.localizacao ?? {},
    tags: input.tags ?? [],
  });
  if (error) throw new Error(`Não consegui salvar a margem: ${error.message}`);
}

export async function updateCodiceBookContent(
  bookId: string,
  values: Pick<CodiceBook, "texto_extraido" | "resumo" | "ultimo_acesso_em">,
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await supabase
    .from("livros")
    .update(values)
    .eq("id", bookId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
