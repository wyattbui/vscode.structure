import * as vscode from "vscode";
import { StructureTreeProvider, StructureItem } from "./structureView";

export function activate(context: vscode.ExtensionContext) {
  let structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);
  vscode.window.registerTreeDataProvider("structureView", structureProvider); // Thêm cho Explorer


  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.filterEntityByText", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
  
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection).trim();
  
      if (!selectedText) {
        return;
      }
      structureProvider.filterEntitiesByName();
    }),

    vscode.commands.registerCommand("structureView.selectEntityByText", () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
  
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection).trim();
  
      if (!selectedText) {
        return;
      }
  
      // ✅ Tìm entity theo tên trong structureProvider
      const entity = structureProvider.findEntityByName(selectedText);
      if (!entity) {
        vscode.window.showWarningMessage(`Entity '${selectedText}' not found.`);
        return;
      }
  
      // ✅ Thêm entity vào danh sách so sánh
      structureProvider.addEntityToComparison(entity);
    }),

    vscode.commands.registerCommand("structureView.filterEntity", (entity: StructureItem) => {
      if (!entity) {return;}
      structureProvider.filterEntitiesByName();
    }),

    vscode.commands.registerCommand("structureView.clearFilter", () => {
      structureProvider.clearFilter();
    }),
    vscode.commands.registerCommand("structureView.clearComparison", () => {
      structureProvider.clearComparison();
    }),

    vscode.commands.registerCommand("structureView.pinEntity", (entity: StructureItem) => {
      if (!entity) {return;}
      structureProvider.pinEntity(entity);
    }),

    vscode.commands.registerCommand("structureView.unpinEntity", (entity: StructureItem) => {
      if (!entity) {return;}
      structureProvider.unpinEntity(entity);
    }),
    vscode.commands.registerCommand("structureView.selectForComparison", (entity: StructureItem) => {
      if (!entity) {return;}
      structureProvider.addEntityToComparison(entity);
    }),
    vscode.commands.registerCommand("structureView.addEntityToComparison", (entity: StructureItem) => {
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
      vscode.window.registerTreeDataProvider("structureView", structureProvider); // Thêm cho Explorer
    }),
    
    vscode.commands.registerCommand("structureView.searchInCurrentFile", (className: string) => {
      structureProvider.searchInCurrentFile(className);
    }),
  );
}

export function deactivate() {}