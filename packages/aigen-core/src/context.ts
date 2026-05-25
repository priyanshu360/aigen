import {
  Project,
  type SourceFile,
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

  return {
    ...call,
    nearbyCode,
    availableImports: imports,
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
