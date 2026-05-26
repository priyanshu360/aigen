import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const CACHE_DIR = ".aigen"
const CACHE_FILE = "cache.json"

interface CacheStore {
  [hash: string]: {
    implementation: string
    createdAt: string
  }
}

export function computeHash(
  functionName: string,
  argTypes: string,
  hint?: string
): string {
  const data = `${functionName}::${argTypes}::${hint ?? ""}`
  return createHash("sha256").update(data).digest("hex")
}

function cachePath(rootDir: string): string {
  return join(rootDir, CACHE_DIR, CACHE_FILE)
}

function ensureCacheDir(rootDir: string): void {
  const dir = join(rootDir, CACHE_DIR)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readCache(rootDir: string): CacheStore {
  const path = cachePath(rootDir)
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return {}
  }
}

function writeCache(rootDir: string, store: CacheStore): void {
  ensureCacheDir(rootDir)
  writeFileSync(cachePath(rootDir), JSON.stringify(store, null, 2), "utf-8")
}

export function getCachedImplementation(
  rootDir: string,
  hash: string
): string | null {
  const store = readCache(rootDir)
  const entry = store[hash]
  return entry?.implementation ?? null
}

export function setCachedImplementation(
  rootDir: string,
  hash: string,
  implementation: string
): void {
  const store = readCache(rootDir)
  store[hash] = {
    implementation,
    createdAt: new Date().toISOString(),
  }
  writeCache(rootDir, store)
}

export function clearCache(rootDir: string): void {
  writeCache(rootDir, {})
}
