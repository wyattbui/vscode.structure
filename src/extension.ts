import * as vscode from "vscode";
import { StructureTreeProvider, StructureItem } from "./structureView";

export function activate(context: vscode.ExtensionContext) {
  const structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);

  let selectedEntities: StructureItem[] = [];

  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.pinEntity", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.pinEntity(entity);
      vscode.window.showInformationMessage(`📌 Pinned ${entity.label}`);
    }),
    vscode.commands.registerCommand("structureView.unpinEntity", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.unpinEntity(entity);
      vscode.window.showInformationMessage(`❌ Unpinned ${entity.label}`);
    }),

    vscode.commands.registerCommand("structureView.selectForComparison", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.addEntityToComparison(entity);
      vscode.window.showInformationMessage(`🔍 Added ${entity.label} to comparison`);
    }),
    vscode.commands.registerCommand("structureView.loadFromSelection", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor found.");
        return;
      }
      structureProvider.parseStructureFromSelection(editor.selection);
    }),

    vscode.commands.registerCommand("structureView.refresh", () => {
      structureProvider.refreshStructure();
      vscode.window.showInformationMessage("🔄 Structure View refreshed successfully!");
    })
  );
}

export function deactivate() {}
