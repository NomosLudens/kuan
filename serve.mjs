/**
 * Adapter Node.js para produção no Replit.
 *
 * O build do TanStack Start gera `dist/server/server.js` no formato
 * Cloudflare Workers ({ fetch(request, env, ctx) }). Este adapter cria
 * um servidor HTTP Node.js compatível, injetando as variáveis de ambiente
 * como `env` e fazendo o bind dos assets estáticos.
 *
 * Uso: node dist/server/serve.mjs (ou via `bun run start`)
 *
 * Secrets necessários no Replit (via painel Replit Secrets):
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENROUTER_API_KEY
 *   (demais opcionais conforme .env.example)
 */

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000", 10);
const ASSETS_DIR = path.join(__dirname, "client");
const CLIENT_INDEX = path.join(ASSETS_DIR, "index.html");

// Mapeamento de extensões para Content-Type
const MIME_TYPES = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".mjs": "application/javascript",
};

async function serveStatic(urlPath) {
  // Normaliza e previne path traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ASSETS_DIR, safePath);

  // Garante que está dentro de ASSETS_DIR
  if (!filePath.startsWith(ASSETS_DIR)) {
    return null;
  }

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return null;

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fs.readFile(filePath);

    return new Response(content, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return null;
  }
}

async function serveIndex() {
  try {
    const content = await fs.readFile(CLIENT_INDEX, "utf-8");
    // Injeta variáveis VITE_ do ambiente diretamente no HTML (apenas para Replit)
    const html = content.replace(/<script([^>]*)><\/script>/, (match, attrs) => {
      const viteScript = `
          <script>
            window.ENV = ${JSON.stringify({
              VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "",
              VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            })};
          </script>`;
      return viteScript + match;
    });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function main() {
  let serverHandler;

  try {
    const serverModule = await import(path.join(__dirname, "server.js"));
    serverHandler = serverModule.default || serverModule;
  } catch (err) {
    console.error("Falha ao carregar server.js:", err);
    process.exit(1);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const method = req.method;

    // Constrói Request object compatível com Workers
    const body =
      method === "GET" || method === "HEAD"
        ? null
        : await new Promise((resolve) => {
            const chunks = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks).toString()));
          });

    const workerRequest = new Request(url.toString(), {
      method,
      headers: req.headers,
      body,
    });

    const env = { ...process.env };
    const ctx = {};

    try {
      const response = await serverHandler.fetch(workerRequest, env, ctx);

      // Roteia: se o Workers handler retornou HTML/SSR, serve. Se não,
      // tenta asset estático. Se nada, serve index.html (SPA fallback).
      if (response.status !== 404) {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        const text = await response.text();
        res.end(text);
        return;
      }

      // Tenta arquivo estático
      const staticRes = await serveStatic(url.pathname);
      if (staticRes) {
        res.writeHead(staticRes.status, Object.fromEntries(staticRes.headers));
        const text = await staticRes.text();
        res.end(text);
        return;
      }

      // SPA fallback
      const indexRes = await serveIndex();
      res.writeHead(indexRes.status, Object.fromEntries(indexRes.headers));
      const text = await indexRes.text();
      res.end(text);
    } catch (err) {
      console.error("Erro no handler:", err);
      res.writeHead(500, { "content-type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  server.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`   Porta: ${PORT}`);
    console.log(`   Ambiente: ${process.env.APP_ENV || "production"}`);
  });
}

main().catch((err) => {
  console.error("Falha fatal:", err);
  process.exit(1);
});
