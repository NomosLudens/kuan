export type ExtractedEpubText = { title?: string; author?: string; text: string };

export type CodiceEpubChapter = {
  index: number;
  title: string;
  text: string;
  href?: string;
};

const MIN_TEXT_CHARS = 200;

type ZipFile = { async(type: "text"): Promise<string> };
type Zip = { file(path: string): ZipFile | null };
type JsZipModule = { default: { loadAsync(data: ArrayBuffer): Promise<Zip> } };

function xml(text: string) {
  return new DOMParser().parseFromString(text, "application/xml");
}

function joinPath(base: string, href: string) {
  if (!base) return href;
  return `${base}/${href}`.replace(/\/[^/]+\/\.\.\//g, "/").replace(/\/\.\//g, "/");
}

function cleanText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

function firstTextByLocalName(doc: Document, name: string) {
  return cleanText(
    [...doc.getElementsByTagName("*")].find((node) => node.localName === name)?.textContent ?? "",
  );
}

function textFromHtml(source: string) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  doc.querySelectorAll("script,style,noscript").forEach((node) => node.remove());
  return cleanText((doc.body.innerText || doc.body.textContent || "").replace(/\r/g, "\n"));
}

function titleFromHtml(source: string) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  return cleanText(
    doc.querySelector("h1,h2,h3,title")?.textContent ??
      doc.querySelector("body")?.textContent?.slice(0, 60) ??
      "",
  );
}

export async function extractEpubChapters(
  blob: Blob,
  maxChars = 200000,
): Promise<{ title?: string; author?: string; text: string; chapters: CodiceEpubChapter[] }> {
  if (typeof window === "undefined") throw new Error("Extração de EPUB só roda no navegador.");

  const { default: JSZip } = (await import("jszip")) as JsZipModule;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const container = zip.file("META-INF/container.xml");
  if (!container) throw new Error("EPUB inválido: container.xml não encontrado.");

  const opfPath = xml(await container.async("text"))
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB inválido: pacote OPF não encontrado.");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB inválido: arquivo OPF ausente.");

  const opf = xml(await opfFile.async("text"));
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/")) : "";
  const manifest = new Map(
    [...opf.querySelectorAll("manifest item")].map((item) => [
      item.getAttribute("id") ?? "",
      item.getAttribute("href") ?? "",
    ]),
  );
  const title = firstTextByLocalName(opf, "title") || undefined;
  const author = firstTextByLocalName(opf, "creator") || undefined;
  const chapters: CodiceEpubChapter[] = [];
  let total = 0;

  for (const ref of opf.querySelectorAll("spine itemref")) {
    if (total >= maxChars) break;
    const href = manifest.get(ref.getAttribute("idref") ?? "");
    if (!href) continue;
    const path = joinPath(base, href);
    const file = zip.file(path);
    if (!file) continue;
    try {
      const html = await file.async("text");
      const text = textFromHtml(html).slice(0, Math.max(0, maxChars - total));
      if (!text) continue;
      chapters.push({
        index: chapters.length,
        title: titleFromHtml(html) || `Seção ${chapters.length + 1}`,
        text,
        href: path,
      });
      total += text.length + 2;
    } catch {
      // Ignore broken sections and keep extracting the rest of the EPUB.
    }
  }

  const text = cleanText(chapters.map((chapter) => chapter.text).join("\n\n")).slice(0, maxChars);
  if (text.length < MIN_TEXT_CHARS)
    throw new Error("Não consegui extrair texto suficiente deste EPUB para leitura.");
  return { title, author, text, chapters };
}

export async function extractEpubText(blob: Blob, maxChars = 80000): Promise<ExtractedEpubText> {
  const result = await extractEpubChapters(blob, maxChars);
  return { title: result.title, author: result.author, text: result.text };
}
