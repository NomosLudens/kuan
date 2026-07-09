export type CodiceLocalChapter = {
  id: string;
  title: string;
  href?: string;
  text: string;
};

export type CodiceLocalBook = {
  id: string;
  title: string;
  author: string | null;
  fileName: string;
  mimeType: string;
  text: string;
  chapters?: CodiceLocalChapter[];
  savedAt: string;
};

const DB_NAME = "codice-local-library";
const DB_VERSION = 1;
const STORE_NAME = "books";

function ensureIndexedDb() {
  if (typeof indexedDB === "undefined") {
    throw new Error("Este navegador não oferece armazenamento local suficiente para o Códice.");
  }
}

function openDb(): Promise<IDBDatabase> {
  ensureIndexedDb();
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir biblioteca local"));
    request.onsuccess = () => resolve(request.result);
  });
}

function runStore<T>(
  mode: IDBTransactionMode,
  runner: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = runner(tx.objectStore(STORE_NAME));

        request.onerror = () => reject(request.error ?? new Error("Falha na biblioteca local"));
        request.onsuccess = () => resolve(request.result);
        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error("Falha na transação local"));
        };
      }),
  );
}

export async function saveLocalBook(book: CodiceLocalBook) {
  await runStore("readwrite", (store) => store.put(book));
}

export async function getLocalBook(id: string) {
  return runStore<CodiceLocalBook | undefined>("readonly", (store) => store.get(id));
}

export async function deleteLocalBook(id: string) {
  await runStore("readwrite", (store) => store.delete(id));
}

export async function listLocalBookIds() {
  return runStore<IDBValidKey[]>("readonly", (store) => store.getAllKeys()).then((keys) =>
    keys.map(String),
  );
}
