function ensureBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Leitura de EPUB só pode rodar no navegador.");
  }
}

export type CodiceEpubOpenPayload = {
  title: string;
  fileName: string;
  blobUrl: string;
  mimeType: "application/epub+zip";
};

export function createEpubBlobUrl(blob: Blob) {
  ensureBrowser();
  return URL.createObjectURL(new Blob([blob], { type: "application/epub+zip" }));
}

export function isEpubFile(name: string, mimeType?: string) {
  return mimeType === "application/epub+zip" || name.toLowerCase().endsWith(".epub");
}
