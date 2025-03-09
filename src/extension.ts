import * as vscode from "vscode";
import { StructureItem, StructureTreeProvider } from "./structureView";
import { MappingTreeProvider } from "./mappingView";

export function activate(context: vscode.ExtensionContext) {
  const structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);

  const mappingProvider = new MappingTreeProvider();
  vscode.window.registerTreeDataProvider("mappingTree", mappingProvider);

  // Lắng nghe khi người dùng mở file mới
  vscode.window.onDidChangeActiveTextEditor(editor => {
    console.log("[DEBUG] Active file changed:", editor?.document.fileName);
    structureProvider.refresh();
  });

  // Lắng nghe khi nội dung file thay đổi
  vscode.workspace.onDidChangeTextDocument(event => {
    console.log("[DEBUG] File content changed:", event.document.fileName);
    structureProvider.refresh();
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.refresh", () => structureProvider.refresh()),
    vscode.commands.registerCommand("mappingView.refresh", () => mappingProvider.refresh()),
    vscode.commands.registerCommand("structureView.showDetail", (element: StructureItem) => {
      vscode.window.showInformationMessage(`Details for: ${element.label}`);
    })
  );
}

export function deactivate() {}
