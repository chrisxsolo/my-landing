// Execute the actual event handler with isolated state/network dependencies.
// This avoids importing the dashboard's unrelated tabs and Supabase clients.
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

export function loadAdminHandler(name: string, bindings: Record<string, unknown>, file = "app/admin/page.tsx") {
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) handler = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw new Error(`Missing handler: ${name}`);
  const code = ts.transpileModule(handler.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const context = vm.createContext({ console, ...bindings });
  vm.runInContext(code, context);
  return context[name] as (...args: unknown[]) => Promise<unknown>;
}
