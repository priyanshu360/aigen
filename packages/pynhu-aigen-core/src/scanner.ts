import {
  Project,
  type SourceFile,
  type CallExpression,
  type PropertyAccessExpression,
  type Expression,
  SyntaxKind,
} from "ts-morph"
import type { CallSite, Argument } from "./types"

export interface ScanResult {
  calls: CallSite[]
}
export function scanSourceFiles(sources: string[]): ScanResult {
  const project = new Project({ skipAddingFilesFromTsConfig: true })

  for (const source of sources) {
    project.addSourceFileAtPath(source)
  }

  const calls: CallSite[] = []

  for (const sourceFile of project.getSourceFiles()) {
    const found = findAigenCalls(sourceFile)
    calls.push(...found)
  }

  return { calls }
}

function findAigenCalls(sourceFile: SourceFile): CallSite[] {
  const calls: CallSite[] = []
  const callExprs = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)

  for (const call of callExprs) {
    const expr = call.getExpression()
    if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) continue

    const propAccess = expr as PropertyAccessExpression
    const objectText = propAccess.getExpression().getText()

    if (objectText !== "aigen") continue

    const functionName = propAccess.getName()
    const allArgs = call.getArguments()
    const lineNumber = call.getStartLineNumber()
    const byteOffset = call.getStart()

    let hint: string | undefined
    let actualArgs = allArgs

    if (allArgs.length > 0) {
      const last = allArgs[allArgs.length - 1]
      const obj = last.asKind(SyntaxKind.ObjectLiteralExpression)
      if (obj) {
        const hintProp = obj.getProperty("hint")?.asKind(SyntaxKind.PropertyAssignment)
        if (hintProp) {
          const initializer = hintProp.getInitializer()
          if (initializer?.getKind() === SyntaxKind.StringLiteral) {
            hint = initializer.getText().slice(1, -1)
            actualArgs = allArgs.slice(0, -1)
          }
        }
      }
    }

    const argTypes: Argument[] = actualArgs.map((arg) => ({
      type: inferType(arg as Expression),
      text: arg.getText(),
      name: arg.getKind() === SyntaxKind.Identifier ? arg.getText() : undefined,
    }))

    const { name: assignmentVar, type: assignmentType } = getAssignmentVariable(call)

    calls.push({
      functionName,
      args: argTypes,
      hint,
      sourceFile: sourceFile.getFilePath(),
      lineNumber,
      byteOffset,
      assignmentVar,
      assignmentType,
    })
  }

  return calls
}

function inferType(arg: Expression): string {
  try {
    const type = arg.getType()
    const text = type.getText()
    if (text && text !== "any") return text
  } catch {}
  return "unknown"
}

function getAssignmentVariable(call: CallExpression): { name?: string; type?: string } {
  const parent = call.getParent()
  if (!parent) return {}

  if (parent.getKind() === SyntaxKind.VariableDeclaration) {
    const decl = parent.asKind(SyntaxKind.VariableDeclaration)
    if (decl) {
      let type: string | undefined
      try {
        const t = decl.getType()
        const text = t.getText()
        if (text && text !== "any") type = text
      } catch {}
      return { name: decl.getName(), type }
    }
  }

  if (parent.getKind() === SyntaxKind.BinaryExpression) {
    const bin = parent.asKind(SyntaxKind.BinaryExpression)
    if (bin) return { name: bin.getLeft().getText() }
  }

  return {}
}
