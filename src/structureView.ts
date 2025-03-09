import * as vscode from "vscode";
import { Project, ClassDeclaration, EnumDeclaration, InterfaceDeclaration, FunctionDeclaration } from "ts-morph";

export class StructureTreeProvider implements vscode.TreeDataProvider<StructureItem> {
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
      return Promise.resolve(this.parseStructure());
    }
    return Promise.resolve(element.children);
  }

  private parseStructure(): StructureItem[] {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return [];

    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", editor.document.getText(), { overwrite: true });

    const structure: StructureItem[] = [];

    // Lấy danh sách Class, Interface, Enum, Function
    sourceFile.getClasses().forEach(cls => {
      const classItem = new StructureItem(`Class: ${cls.getName()}`, vscode.TreeItemCollapsibleState.Collapsed);
      classItem.children = this.getClassMembers(cls);
      structure.push(classItem);
    });

    sourceFile.getInterfaces().forEach(iface => {
      structure.push(new StructureItem(`Interface: ${iface.getName()}`, vscode.TreeItemCollapsibleState.None));
    });

    sourceFile.getEnums().forEach(enm => {
      structure.push(new StructureItem(`Enum: ${enm.getName()}`, vscode.TreeItemCollapsibleState.None));
    });

    sourceFile.getFunctions().forEach(func => {
      structure.push(new StructureItem(`Function: ${func.getName()}()`, vscode.TreeItemCollapsibleState.None));
    });

    return structure;
  }

  private getClassMembers(cls: ClassDeclaration): StructureItem[] {
    const members: StructureItem[] = [];

    cls.getProperties().forEach(prop => {
      members.push(new StructureItem(`Property: ${prop.getName()}`, vscode.TreeItemCollapsibleState.None));
    });

    cls.getMethods().forEach(method => {
      members.push(new StructureItem(`Method: ${method.getName()}()`, vscode.TreeItemCollapsibleState.None));
    });

    return members;
  }
}

export class StructureItem extends vscode.TreeItem {
  children: StructureItem[] = [];

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}
