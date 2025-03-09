import * as vscode from "vscode";
import { StructureTreeProvider } from "./structureView";
import { MappingTreeProvider } from "./mappingView";

export function activate(context: vscode.ExtensionContext) {
  const structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);

  const mappingProvider = new MappingTreeProvider();
  vscode.window.registerTreeDataProvider("mappingTree", mappingProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.refresh", () => structureProvider.refresh()),
    vscode.commands.registerCommand("mappingView.refresh", () => mappingProvider.refresh())
  );
}

export function deactivate() {}
