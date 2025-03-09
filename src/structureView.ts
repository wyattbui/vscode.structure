import * as vscode from "vscode";
import * as path from "path";
import { fileURLToPath } from "url";

import { Project, ClassDeclaration, FunctionDeclaration, EnumDeclaration, PropertyDeclaration } from "ts-morph";

declare const __filename: string;
declare const __dirname: string;


export class StructureTreeProvider implements vscode.TreeDataProvider<StructureItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StructureItem | undefined | void> = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    if (element.contextValue === "enum" || element.contextValue === "property") {
      element.command = {
        command: "structureView.showDetail",
        title: "Show Detail",
        arguments: [element]
      };
    }
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
    if (!editor) {return [];}

    const project = new Project();
    const sourceFile = project.createSourceFile("temp.ts", editor.document.getText(), { overwrite: true });

    const structure: StructureItem[] = [];

    // Duyệt các class trong file
    sourceFile.getClasses().forEach(cls => {
      const classItem = new StructureItem(cls.getName() || "Unnamed Class", vscode.TreeItemCollapsibleState.Collapsed, "class");
      classItem.children = this.getClassMembers(cls);
      structure.push(classItem);
    });

    // Duyệt các function
    sourceFile.getFunctions().forEach(func => {
      structure.push(new StructureItem(`${func.getName()}()`, vscode.TreeItemCollapsibleState.None, "function"));
    });

    // Duyệt các enum
    sourceFile.getEnums().forEach(enm => {
      const enumItem = new StructureItem(enm.getName() || "Unnamed Enum", vscode.TreeItemCollapsibleState.Collapsed, "enum");
      enumItem.children = this.getEnumMembers(enm);
      structure.push(enumItem);
    });

    return structure;
  }

  private getClassMembers(cls: ClassDeclaration): StructureItem[] {
    const members: StructureItem[] = [];

    cls.getProperties().forEach(prop => {
      members.push(new StructureItem(`${prop.getName()}: ${prop.getType().getText()}`, vscode.TreeItemCollapsibleState.None, "property"));
    });

    cls.getMethods().forEach(method => {
      const methodItem = new StructureItem(`${method.getName()}()`, vscode.TreeItemCollapsibleState.Collapsed, "method");
      methodItem.children = method.getParameters().map(param => 
        new StructureItem(`${param.getName()}: ${param.getType().getText()}`, vscode.TreeItemCollapsibleState.None, "parameter")
      );
      members.push(methodItem);
    });

    return members;
  }

  private getEnumMembers(enm: EnumDeclaration): StructureItem[] {
    return enm.getMembers().map(member => 
      new StructureItem(`${member.getName()} = ${member.getValue()}`, vscode.TreeItemCollapsibleState.None, "enum-member")
    );
  }
}

export class StructureItem extends vscode.TreeItem {
  children: StructureItem[] = [];

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, icon: string) {
    super(label, collapsibleState);
    this.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, "..", "..", "resources", `${icon}.svg`)),
      dark: vscode.Uri.file(path.join(__dirname, "..", "..", "resources", `${icon}.svg`))
    };
  }
}


// Gán icon tương ứng cho từng loại phần tử trong code
const classItem = new StructureItem("MyClass", vscode.TreeItemCollapsibleState.Collapsed, "class");
const functionItem = new StructureItem("myFunction()", vscode.TreeItemCollapsibleState.None, "function");
const methodItem = new StructureItem("myMethod()", vscode.TreeItemCollapsibleState.Collapsed, "method");
const propertyItem = new StructureItem("myProperty: string", vscode.TreeItemCollapsibleState.None, "property");
const enumItem = new StructureItem("MyEnum", vscode.TreeItemCollapsibleState.Collapsed, "enum");
const interfaceItem = new StructureItem("MyInterface", vscode.TreeItemCollapsibleState.Collapsed, "interface");
const variableItem = new StructureItem("myVar: number", vscode.TreeItemCollapsibleState.None, "variable");