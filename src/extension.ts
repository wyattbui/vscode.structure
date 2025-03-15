import * as vscode from "vscode";
import { StructureTreeProvider, StructureItem,TEST } from "./structureView";
console.log(TEST.Enum1)

export function activate(context: vscode.ExtensionContext) {
  let structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);

  let selectedEntities: StructureItem[] = [];

  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.filterEntity", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.filterEntitiesByName();
    }),

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
      vscode.window.showInformationMessage("🔄 Structure View created successfully!");
    }),

    vscode.commands.registerCommand("structureView.refresh", () => {
      // structureProvider.refreshStructure();
      structureProvider = new StructureTreeProvider();
      vscode.window.registerTreeDataProvider("structureTree", structureProvider);
      vscode.window.showInformationMessage("🔄 Structure View refreshed successfully!");
    }),
    
    vscode.commands.registerCommand("structureView.searchInCurrentFile", (className: string) => {
      structureProvider.searchInCurrentFile(className);
    }),
  );
}

export function deactivate() {}
