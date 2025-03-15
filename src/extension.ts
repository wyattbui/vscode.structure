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

    vscode.commands.registerCommand("structureView.clearFilter", () => {
      structureProvider.clearFilter();
    }),

    vscode.commands.registerCommand("structureView.pinEntity", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.pinEntity(entity);
    }),

    vscode.commands.registerCommand("structureView.unpinEntity", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.unpinEntity(entity);
    }),

    vscode.commands.registerCommand("structureView.selectForComparison", (entity: StructureItem) => {
      if (!entity) return;
      structureProvider.addEntityToComparison(entity);
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
      structureProvider = new StructureTreeProvider();
      vscode.window.registerTreeDataProvider("structureTree", structureProvider);
    }),
    
    vscode.commands.registerCommand("structureView.searchInCurrentFile", (className: string) => {
      structureProvider.searchInCurrentFile(className);
    }),
  );
}

export function deactivate() {}
