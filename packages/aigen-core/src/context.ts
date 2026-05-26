import {
  Project,
  type SourceFile,
  type Node,
  SyntaxKind,
} from "ts-morph"
import type { CallSite, FunctionContext } from "./types"

const NEARBY_FALLBACK_RANGE = 15
const ENCLOSURE_MAX_CHARS = 3000

export function collectContext(
  call: CallSite,
  sourceFiles: SourceFile[]
): FunctionContext {
  const sourceFile = sourceFiles.find(
    (sf) => sf.getFilePath() === call.sourceFile
  )
  if (!sourceFile) {
    return {
      ...call,
      nearbyCode: "",
      availableImports: [],
    }
  }

  const callNode = findCallNode(sourceFile, call.byteOffset)
  const enclosure = callNode ? findEnclosingFunction(callNode) : undefined
  const nearbyCode = enclosure
    ? extractNearbyCode(enclosure)
    : extractNearbyFallback(sourceFile, call.lineNumber)
  const imports = extractImports(sourceFile)
  const parentFunction = enclosure ? extractParentFunction(enclosure) : undefined

  return {
    ...call,
    nearbyCode,
    availableImports: imports,
    parentFunction,
  }
}

export function collectAllContexts(
  calls: CallSite[]
): FunctionContext[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  const filePaths = [...new Set(calls.map((c) => c.sourceFile))]
  const sourceFiles: SourceFile[] = []

  for (const fp of filePaths) {
    try {
      sourceFiles.push(project.addSourceFileAtPath(fp))
    } catch {}
  }

  return calls.map((call) => collectContext(call, sourceFiles))
}

function findEnclosingFunction(node: Node): Node | undefined {
  return (
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ??
    node.getFirstAncestorByKind(SyntaxKind.FunctionExpression)
  )
}

function extractNearbyCode(
  enclosure: Node,
): string {
  const text = enclosure.getText()
  if (text.length <= ENCLOSURE_MAX_CHARS) return text

  const trimmed = text.slice(0, ENCLOSURE_MAX_CHARS)
  const lastNewline = trimmed.lastIndexOf("\n")
  return lastNewline > 0 ? trimmed.slice(0, lastNewline) : trimmed
}

function extractNearbyFallback(
  sourceFile: SourceFile,
  lineNumber: number
): string {
  const allLines = sourceFile.getText().split("\n")
  const start = Math.max(0, lineNumber - 1 - NEARBY_FALLBACK_RANGE)
  const end = Math.min(allLines.length, lineNumber + NEARBY_FALLBACK_RANGE)
  return allLines.slice(start, end).join("\n")
}

function extractImports(sourceFile: SourceFile): string[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.ImportDeclaration)
    .map((imp) => imp.getText())
    .filter((text) => !text.includes("@aigen/runtime"))
}

function findCallNode(
  sourceFile: SourceFile,
  byteOffset: number
): Node | undefined {
  const nodes = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  return nodes.find((n) => n.getStart() === byteOffset)
}

function extractParentFunction(
  enclosure: Node,
): { name: string; signature?: string; jsDoc?: string } | undefined {
  let name: string
  let sigNode = enclosure

  if (enclosure.isKind(SyntaxKind.FunctionDeclaration) || enclosure.isKind(SyntaxKind.MethodDeclaration)) {
    name = enclosure.getName() ?? "(anonymous)"
  } else if (enclosure.isKind(SyntaxKind.ArrowFunction) || enclosure.isKind(SyntaxKind.FunctionExpression)) {
    const varDecl = enclosure.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
    name = varDecl?.getName() ?? "(anonymous)"
    if (varDecl) sigNode = varDecl
  } else {
    name = "(anonymous)"
  }

  const fullText = sigNode.getText()
  const braceIdx = fullText.indexOf("{")
  const signature = braceIdx >= 0 ? fullText.slice(0, braceIdx).trim() : fullText.trim()

  const jsDoc = extractJsDoc(enclosure)

  return { name, signature, jsDoc }
}

function extractJsDoc(node: Node): string | undefined {
  const fn = node as unknown as { getJsDocs(): Array<{ getText(): string }> }
  const docs = fn.getJsDocs()
  return docs.length > 0 ? docs.map((d) => d.getText()).join("\n") : undefined
}
