import * as vscode from "vscode";
import { Project } from "ts-morph";

export class MappingTreeProvider implements vscode.TreeDataProvider<StructureItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StructureItem | undefined | void> = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StructureItem): Thenable<StructureItem[]> {
    if (!element) {
      return Promise.resolve(this.findMappings());
    }
    return Promise.resolve([]);
  }

  private findMappings(): StructureItem[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return [];
    }

    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", editor.document.getText(), { overwrite: true });

    const mappings: StructureItem[] = [];

    sourceFile.getClasses().forEach(cls => {
      if (cls.getName()?.includes("DTO")) {
        mappings.push(new StructureItem(`DTO: ${cls.getName()} ↔ Entity`, vscode.TreeItemCollapsibleState.None));
      }
    });

    return mappings;
  }
}

export class StructureItem extends vscode.TreeItem {
  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}
