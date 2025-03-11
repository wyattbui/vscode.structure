import * as vscode from "vscode";
import { StructureTreeProvider, StructureItem } from "./structureView";

export function activate(context: vscode.ExtensionContext) {
  const structureProvider = new StructureTreeProvider();
  vscode.window.registerTreeDataProvider("structureTree", structureProvider);

  let selectedEntities: StructureItem[] = [];

  context.subscriptions.push(
    vscode.commands.registerCommand("structureView.refresh", () => structureProvider.refresh()),

    vscode.commands.registerCommand("structureView.pinEntity", (entity: StructureItem) => {
      structureProvider.pinEntity(entity);
      vscode.window.showInformationMessage(`📌 Pinned ${entity.label}`);
    }),

    vscode.commands.registerCommand("structureView.unpinEntity", (entity: StructureItem) => {
      structureProvider.unpinEntity(entity);
      vscode.window.showInformationMessage(`❌ Unpinned ${entity.label}`);
    }),

    vscode.commands.registerCommand("structureView.selectForComparison", (entity: StructureItem) => {
      if (selectedEntities.length < 2) {
        selectedEntities.push(entity);
        vscode.window.showInformationMessage(`✅ Select ${entity.label} to compare: `);
      }
      if (selectedEntities.length === 2) {
        compareEntities(selectedEntities[0], selectedEntities[1]);
        selectedEntities = [];
      }
    })
  );
}

function compareEntities(entity1: StructureItem, entity2: StructureItem) {
  const props1 = new Set(entity1.children.map(child => child.label));
  const props2 = new Set(entity2.children.map(child => child.label));

  const commonProps = [...props1].filter(prop => props2.has(prop));
  const uniqueToEntity1 = [...props1].filter(prop => !props2.has(prop));
  const uniqueToEntity2 = [...props2].filter(prop => !props1.has(prop));

  const message = [
    `🔍 **Compare ${entity1.label} vs ${entity2.label}**`,
    `✅ **Same**:\n${commonProps.join("\n")}`,
    `❌ **${entity1.label}**:\n${uniqueToEntity1.join("\n")}`,
    `❌ **${entity2.label}**:\n${uniqueToEntity2.join("\n")}`
  ].join("\n\n");

  vscode.window.showInformationMessage(message);
}

export function deactivate() {}
