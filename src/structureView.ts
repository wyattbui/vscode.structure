import * as vscode from "vscode";
import { Project, SourceFile, ClassDeclaration, EnumDeclaration } from "ts-morph";

export class StructureTreeProvider implements vscode.TreeDataProvider<StructureItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<StructureItem | undefined | void> = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> = this._onDidChangeTreeData.event;

  private currentFilePath: string | null = null;
  private selectedComparisons: StructureItem[] = []; // Lưu danh sách các DTO/Entity được chọn để so sánh
  private pinnedEntities: Map<string, StructureItem> = new Map();
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

  /** 📌 Ghim Entity/DTO */
  pinEntity(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString();
    if (!this.pinnedEntities.has(label)) {
      const pinnedEntity = new StructureItem(`📌 ${entity.label}`, entity.collapsibleState || vscode.TreeItemCollapsibleState.None, "pinned");
      pinnedEntity.children = entity.children;
      this.pinnedEntities.set(label, pinnedEntity);
      vscode.commands.executeCommand("setContext", "structureView.hasPinnedItems", true);
      this.refresh();
    }
  }

  /** ❌ Bỏ ghim Entity/DTO */
  unpinEntity(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString().replace("📌 ", "");
    if (this.pinnedEntities.has(label)) {
      this.pinnedEntities.delete(label);
      if (this.pinnedEntities.size === 0) {
        vscode.commands.executeCommand("setContext", "structureView.hasPinnedItems", false);
      }
      this.refresh();
    }
  }

  /** 🔍 Thêm Entity vào danh sách so sánh */
  addEntityToComparison(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString();
    if (!this.selectedComparisons.some(item => item.label === label)) {
      const comparisonEntity = new StructureItem(`🔍 ${entity.label}`, vscode.TreeItemCollapsibleState.Collapsed, "compare");
      comparisonEntity.children = entity.children;
      this.selectedComparisons.push(comparisonEntity);
      this.refresh();
    }
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StructureItem): Thenable<StructureItem[]> {
    if (!this.currentFilePath) {
      return Promise.resolve([
        new StructureItem("📂 Open a TypeScript file to view structure", vscode.TreeItemCollapsibleState.None, "info")
      ]);
    }

    if (!element) {
      let rootItems = [...this.pinnedEntities.values(), ...this.parseStructure(this.currentFilePath)];

      if (this.selectedComparisons.length > 0) {
        const comparisonRoot = new StructureItem(`🔍 Comparison Results`, vscode.TreeItemCollapsibleState.Expanded, "compare-root");
        comparisonRoot.children = this.selectedComparisons;
        rootItems.push(comparisonRoot);
      }

      return Promise.resolve(rootItems);
    }

    return Promise.resolve(element.children);
  }

  private parseStructure(filePath: string): StructureItem[] {
    const sourceFile: SourceFile = this.project.addSourceFileAtPath(filePath);
    const structure: StructureItem[] = [];

    sourceFile.getImportDeclarations().forEach(importDecl => {
      importDecl.getNamedImports().forEach(namedImport => {
        const importName = namedImport.getName();
        const importFile = importDecl.getModuleSpecifierSourceFile()?.getFilePath();

        if (importFile) {
          const entityDetails = this.getEntityOrEnumDetails(importFile, importName);
          if (entityDetails.length > 0) {
            const entityItem = new StructureItem(`📦 ${importName}`, vscode.TreeItemCollapsibleState.Collapsed, "class");
            entityItem.children = entityDetails;
            entityItem.contextValue = "entity";
            structure.push(entityItem);
          }
        }
      });
    });

    return structure;
  }

  /** ✅ **Thêm lại hàm `getEntityOrEnumDetails` để lấy thông tin Entity và Enum** */
  private getEntityOrEnumDetails(filePath: string, name: string): StructureItem[] {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const entityClass = sourceFile.getClass(name);
    const enumDecl = sourceFile.getEnum(name);

    if (entityClass) {
      return entityClass.getProperties().map(prop => {
        return new StructureItem(`🔹 ${prop.getName()}: ${prop.getType().getText()}`, vscode.TreeItemCollapsibleState.None, "property");
      });
    }

    if (enumDecl) {
      return enumDecl.getMembers().map(member => {
        return new StructureItem(`🔸 ${member.getName()} = ${member.getValue()}`, vscode.TreeItemCollapsibleState.None, "enum-member");
      });
    }

    return [];
  }
}

export class StructureItem extends vscode.TreeItem {
  children: StructureItem[] = [];

  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None, icon: string) {
    super(label, collapsibleState);
  }
}
