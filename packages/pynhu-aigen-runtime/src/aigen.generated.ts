// Build plugins (Vite/esbuild) alias `@pynhu/aigen-runtime` to the generated file in the user's project.
// This stub provides a value-type fallback so TypeScript sees `aigen` as a const, not a namespace.
// At build time, the plugin resolves `import { aigen } from "@pynhu/aigen-runtime"` to the real generated file.
export const aigen: Record<string, (...args: any[]) => any> = {} as any
