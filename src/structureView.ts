import * as vscode from "vscode";
import * as path from "path";
import { Project, SourceFile, ClassDeclaration } from "ts-morph";

export class StructureTreeProvider implements vscode.TreeDataProvider<StructureItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StructureItem | undefined | void> = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> = this._onDidChangeTreeData.event;

  private currentFilePath: string | null = null;
  private pinnedEntities: Map<string, StructureItem> = new Map(); // Lưu DTO/Entity đã ghim
  private project = new Project();

  constructor() {
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor?.document.languageId === "typescript") {
        this.currentFilePath = editor.document.fileName;
        this.refresh();
      }
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  pinEntity(entity: StructureItem) {
    if (!entity.label) {
      vscode.window.showErrorMessage("🚨 Cannot pin Entity/DTO");
      return;
    }

    const label = typeof entity.label === "string" ? entity.label : JSON.stringify(entity.label);
    if (label) {
      this.pinnedEntities.set(label, entity);
      this.refresh();
    }
  }
  
  unpinEntity(entity: StructureItem) {
    const label = typeof entity.label === "string" ? entity.label : JSON.stringify(entity.label);
    if (label) {
      this.pinnedEntities.delete(label);
      this.refresh();
    }
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StructureItem): Thenable<StructureItem[]> {
    if (!this.currentFilePath) {
      return Promise.resolve([
        new StructureItem("📂 Mở file TypeScript để xem cấu trúc", vscode.TreeItemCollapsibleState.None, "info")
      ]);
    }

    if (!element) {
      return Promise.resolve(this.parseStructure(this.currentFilePath));
    }

    return Promise.resolve(element.children);
  }

  private parseStructure(filePath: string): StructureItem[] {
    const sourceFile: SourceFile = this.project.addSourceFileAtPath(filePath);
    const structure: StructureItem[] = [...this.pinnedEntities.values()]; // Load các entity đã ghim trước

    sourceFile.getImportDeclarations().forEach(importDecl => {
      importDecl.getNamedImports().forEach(namedImport => {
        const importName = namedImport.getName();
        const importFile = importDecl.getModuleSpecifierSourceFile()?.getFilePath();

        if (importFile && !this.pinnedEntities.has(importName)) {
          const entityItem = new StructureItem(`📦 ${importName}`, vscode.TreeItemCollapsibleState.Collapsed, "class");
          entityItem.children = this.getEntityDetails(importFile, importName);
          entityItem.contextValue = "entity";
          structure.push(entityItem);
        }
      });
    });

    return structure;
  }

  private getEntityDetails(filePath: string, className: string): StructureItem[] {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const entityClass = sourceFile.getClass(className);

    if (!entityClass) return [];

    return entityClass.getProperties().map(prop => {
      const typeText = prop.getType().getText();
      return new StructureItem(`🔹 ${prop.getName()}: ${this.colorizeType(typeText)}`, vscode.TreeItemCollapsibleState.None, "property");
    });
  }

  private colorizeType(type: string): string {
    if (type.includes("string")) return `🟦 ${type}`;
    if (type.includes("number")) return `🟨 ${type}`;
    if (type.includes("boolean")) return `🟩 ${type}`;
    if (type.includes("Date")) return `🟧 ${type}`;
    if (type.includes("Array")) return `🟣 ${type}`;
    return `⚪ ${type}`;
  }
}

export class StructureItem extends vscode.TreeItem {
  children: StructureItem[] = [];

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState, icon: string) {
    super(label, collapsibleState);
    this.iconPath = {
      light: vscode.Uri.file(path.join(__dirname, "..", "resources", `${icon}.svg`)),
      dark: vscode.Uri.file(path.join(__dirname, "..", "resources", `${icon}.svg`))
    };
  }
}
