import {
  Project,
  type SourceFile,
  type Node,
  SyntaxKind,
} from "ts-morph"
import type { CallSite, FunctionContext } from "./types"

const NEARBY_LINE_RANGE = 10

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

  const nearbyCode = extractNearbyCode(sourceFile, call.lineNumber)
  const imports = extractImports(sourceFile)

  // Walk up AST from the call line to find enclosing function
  const callNode = findCallNode(sourceFile, call.lineNumber)
  const parentFunction = callNode ? extractParentFunction(callNode) : undefined

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

function extractNearbyCode(
  sourceFile: SourceFile,
  lineNumber: number
): string {
  const allLines = sourceFile.getText().split("\n")
  const start = Math.max(0, lineNumber - 1 - NEARBY_LINE_RANGE)
  const end = Math.min(allLines.length, lineNumber + NEARBY_LINE_RANGE)
  return allLines.slice(start, end).join("\n")
}

function extractImports(sourceFile: SourceFile): string[] {
  return sourceFile
    .getDescendantsOfKind(SyntaxKind.ImportDeclaration)
    .map((imp) => imp.getText())
}

function findCallNode(
  sourceFile: SourceFile,
  lineNumber: number
): Node | undefined {
  const nodes = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
  return nodes.find((n) => n.getStartLineNumber() === lineNumber)
}

function extractParentFunction(node: Node): { name: string; signature?: string; jsDoc?: string } | undefined {
  const funcNode =
    node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
    node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ??
    node.getFirstAncestorByKind(SyntaxKind.FunctionExpression)

  if (!funcNode) return undefined

  let name: string
  if (funcNode.isKind(SyntaxKind.FunctionDeclaration) || funcNode.isKind(SyntaxKind.MethodDeclaration)) {
    name = funcNode.getName() ?? "(anonymous)"
  } else {
    name = "(anonymous)"
  }

  // Extract the function signature (first line up to the opening brace)
  const fullText = funcNode.getText()
  const braceIdx = fullText.indexOf("{")
  const signature = braceIdx >= 0 ? fullText.slice(0, braceIdx).trim() : fullText.trim()

  const jsDocs = funcNode.getJsDocs()
  const jsDoc = jsDocs.length > 0
    ? jsDocs.map((d) => d.getText()).join("\n")
    : undefined

  return { name, signature, jsDoc }
}
