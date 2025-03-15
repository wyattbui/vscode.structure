import * as vscode from "vscode";
import {
  Project,
  SourceFile,
  ClassDeclaration,
  EnumDeclaration,
  SyntaxKind,
} from "ts-morph";

export enum TEST {
  Enum1 = 1,
  Enum2 = 2,
}

export class StructureTreeProvider
  implements vscode.TreeDataProvider<StructureItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    StructureItem | undefined | void
  > = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private currentFilePath: string | null = null;
  private selectedStructures: StructureItem[] = []; // Lưu trữ DTO/Entity từ vùng chọn
  private selectedComparisons: StructureItem[] = []; // Lưu danh sách các DTO/Entity được chọn để so sánh
  private allEntities: StructureItem[] = []; // Lưu trữ tất cả DTO/Entity
  private filteredEntities: StructureItem[] = []; // Lưu trữ kết quả lọc
  private filterText: string | null = null; // Chuỗi tìm kiếm hiện tại
  private searchResults: vscode.Position[] = []; // Lưu trữ danh sách vị trí tìm thấy
  private searchIndexMap: Map<string, number> = new Map(); // Lưu vị trí hiện tại của từng class

  private pinnedEntities: Map<string, StructureItem> = new Map();
  private project = new Project();

  constructor() {
    console.log(this.currentFilePath);
    if (!this.currentFilePath) {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        this.currentFilePath = editor.document.fileName;
        this.refresh();
      }
    }
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === "typescript") {
        this.currentFilePath = editor.document.fileName;
        this.refresh();
      }
    });

    vscode.commands.executeCommand(
      "setContext",
      "structureView.hasPinnedItems",
      this.pinnedEntities.size > 0
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /** 🔄 Refresh Structure View - Reset toàn bộ trạng thái */
  refreshStructure(): void {
    this.pinnedEntities.clear();
    this.selectedComparisons = [];
    this.selectedStructures = [];
    this.refresh();
  }

  /** 📌 Ghim Entity/DTO */
  pinEntity(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString();
    if (!this.pinnedEntities.has(label)) {
      const pinnedEntity = new StructureItem(
        `📌 ${entity.label}`,
        entity.collapsibleState || vscode.TreeItemCollapsibleState.None,
        "pinned"
      );
      pinnedEntity.children = entity.children;
      this.pinnedEntities.set(label, pinnedEntity);
      pinnedEntity.contextValue = "pinned"; // ✅ Đặt contextValue để hiển thị nút "Unpin"
      vscode.commands.executeCommand(
        "setContext",
        "structureView.hasPinnedItems",
        true
      );

      this.refresh();
    }
  }

  /** ❌ Bỏ ghim Entity/DTO */
  unpinEntity(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString().replace(/^📌\s*/, "");
    if (this.pinnedEntities.has(label)) {
      this.pinnedEntities.delete(label);
      vscode.commands.executeCommand(
        "setContext",
        "structureView.hasPinnedItems",
        this.pinnedEntities.size > 0
      );

      this.refresh();
    }
  }

  /** 🔍 Thêm Entity vào danh sách so sánh */
  addEntityToComparison(entity: StructureItem) {
    if (!entity.label) return;
    const label = entity.label.toString();
    if (!this.selectedComparisons.some((item) => item.label === label)) {
      const comparisonEntity = new StructureItem(
        `🔍 ${entity.label}`,
        vscode.TreeItemCollapsibleState.Collapsed,
        "compare"
      );
      comparisonEntity.children = entity.children;
      this.selectedComparisons.push(comparisonEntity);
      this.refresh();
    }
  }

  clearFilter() {
    console.log("🚀 Clearing filter...");
    this.filterText = null;
    this.filteredEntities = this.allEntities; // Reset danh sách về trạng thái ban đầu
    this.refresh();
  }
  
  /** ✅ Lọc DTO/Entity theo tên */
  filterEntitiesByName() {
    const editor = vscode.window.activeTextEditor;
    let selectedText: string | undefined;

    // Nếu có editor đang mở
    if (editor) {
      const selection = editor.selection;
      selectedText = editor.document.getText(selection).trim(); // Lấy nội dung vùng chọn
    }

    // Nếu có văn bản được chọn, sử dụng luôn để lọc
    if (selectedText) {
      console.log("🔍 Filtering by selected text:", selectedText);
      this.applyFilter(selectedText);
      return;
    }

    // Nếu không có vùng chọn, mở hộp thoại nhập
    vscode.window
      .showInputBox({
        prompt: "🔍 Enter name to filter DTO/Entity",
        placeHolder: "Example: UserDto, OrderEntity...",
      })
      .then((input) => {
        if (!input) {
          console.log("❌ No input provided");
          return;
        }
        this.applyFilter(input.trim());
      });
  }

  /** ✅ Hàm riêng để áp dụng bộ lọc */
  private applyFilter(filterText: string) {
    this.filterText = filterText.toLowerCase();
    console.log("📌 Applying filter:", this.filterText);

    if (this.filterText === "") {
      this.filteredEntities = this.allEntities;
    } else {
      this.filteredEntities = this.allEntities
        .map((groupItem) => {
          const filteredChildren = groupItem.children.filter((entity) => {
            const labelText =
              typeof entity.label === "string"
                ? entity.label.toLowerCase()
                : entity.label?.label?.toLowerCase() ?? "";
            return labelText.includes(this.filterText ?? "");
          });

          if (filteredChildren.length > 0) {
            const groupLabel =
              typeof groupItem.label === "string"
                ? groupItem.label
                : groupItem.label?.label ?? "Unknown";

            const newGroup = new StructureItem(
              groupLabel,
              vscode.TreeItemCollapsibleState.Collapsed,
              "folder"
            );
            newGroup.children = filteredChildren;
            return newGroup;
          }

          return null;
        })
        .filter(Boolean) as StructureItem[];
    }

    console.log("✅ Filtered Entities:", this.filteredEntities);
    this.refresh();
  }

  /** 📌 Chỉ load DTO/Entity/Enum từ vùng được chọn */
  parseStructureFromSelection(selection: vscode.Selection) {
    if (!this.currentFilePath) {
      return;
    }

    const sourceFile: SourceFile = this.project.addSourceFileAtPath(
      this.currentFilePath
    );
    const nodeAtSelection = sourceFile.getDescendantAtPos(
      selection.start.character
    );
    if (!nodeAtSelection) {
      return;
    }

    let selectedClassOrEnum: ClassDeclaration | EnumDeclaration | null = null;

    if (nodeAtSelection.isKind(SyntaxKind.ClassDeclaration)) {
      selectedClassOrEnum = nodeAtSelection as ClassDeclaration;
    } else if (nodeAtSelection.isKind(SyntaxKind.EnumDeclaration)) {
      selectedClassOrEnum = nodeAtSelection as EnumDeclaration;
    } else {
      selectedClassOrEnum = nodeAtSelection.getFirstAncestorByKind(
        SyntaxKind.ClassDeclaration
      ) as ClassDeclaration | EnumDeclaration;
    }

    if (selectedClassOrEnum) {
      const filePath = sourceFile.getFilePath();
      const className = selectedClassOrEnum.getName();

      if (!filePath || !className) {
        vscode.window.showErrorMessage(
          "❌ Cannot determine file path or class name."
        );
        return;
      }

      const entityDetails = this.getEntityOrEnumDetails(filePath, className);
      if (entityDetails.length > 0) {
        const entityItem = new StructureItem(
          `📦 ${className}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          "class"
        );
        entityItem.children = entityDetails;
        entityItem.contextValue = "entity";
        this.selectedStructures = [entityItem];
        this.refresh();
      }
    }
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    console.log(`🔍 Item: ${element.label}, Context: ${element.contextValue}`);
    return element;
  }

  getChildren(element?: StructureItem): Thenable<StructureItem[]> {
    if (!this.currentFilePath) {
      return Promise.resolve([
        new StructureItem(
          "📂 Open a TypeScript file to view structure",
          vscode.TreeItemCollapsibleState.None,
          "info"
        ),
      ]);
    }

    if (!element) {
      // return Promise.resolve(
      //   this.filterText ? this.filteredEntities : this.allEntities
      // );

      let rootItems = [
        ...this.pinnedEntities.values(),
        ...this.parseStructure(this.currentFilePath),
      ];

      if (this.selectedComparisons.length > 0) {
        const comparisonRoot = new StructureItem(
          `🔍 Comparison Results`,
          vscode.TreeItemCollapsibleState.Expanded,
          "compare-root"
        );
        comparisonRoot.children = this.selectedComparisons;
        rootItems.push(comparisonRoot);

        return Promise.resolve(
          this.filterText ? this.filteredEntities : this.allEntities
        );
      }

      return Promise.resolve(rootItems);
    }

    return Promise.resolve(element.children);
  }

  /** ✅ Khi click vào class -> tự động tìm trong file đang mở */
  async searchInCurrentFile(className: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage("⚠️ No active editor found.");
      return;
    }

    const document = editor.document;
    const text = document.getText();
    // ✅ Tạo regex tìm class với nhiều biến thể
    const classRegex = new RegExp(`${className}`, "g");
    const searchResults: vscode.Position[] = [];

    let match;
    while ((match = classRegex.exec(text)) !== null) {
      const position = document.positionAt(match.index);
      searchResults.push(position);
    }

    if (searchResults.length === 0) {
      vscode.window.showInformationMessage(
        `🔍 Class "${className}" not found in current file.`
      );
      return;
    }

    // ✅ Lưu danh sách vị trí của class này nếu chưa có
    this.searchResults = searchResults;
    if (!this.searchIndexMap.has(className)) {
      this.searchIndexMap.set(className, 0);
    }

    // ✅ Lấy vị trí tiếp theo trong danh sách
    let currentIndex = this.searchIndexMap.get(className)!;
    const nextIndex = (currentIndex + 1) % searchResults.length; // Vòng lại vị trí đầu nếu hết
    this.searchIndexMap.set(className, nextIndex);

    const position = searchResults[currentIndex];
    const selection = new vscode.Selection(position, position);

    editor.selection = selection;
    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
  }

  /** ✅ Cập nhật `parseStructure` để gom nhóm theo hậu tố */
  private parseStructure(filePath: string): StructureItem[] {
    if (this.filteredEntities && this.filteredEntities.length > 0) {
      return this.filteredEntities;
    }

    const sourceFile: SourceFile = this.project.addSourceFileAtPath(filePath);
    const structure: StructureItem[] = [];

    const groupedItems: { [key: string]: StructureItem[] } = {
      Entity: [],
      Dto: [],
      Type: [],
      Enum: [],
      Other: [],
    };

    sourceFile.getImportDeclarations().forEach((importDecl) => {
      importDecl.getNamedImports().forEach((namedImport) => {
        const importName = namedImport.getName();
        const importFile = importDecl
          .getModuleSpecifierSourceFile()
          ?.getFilePath();

        if (importFile) {
          const entityDetails = this.getEntityOrEnumDetails(
            importFile,
            importName
          );
          if (entityDetails.length > 0) {
            const entityItem = new StructureItem(
              `📦 ${importName}`,
              vscode.TreeItemCollapsibleState.Collapsed,
              "class"
            );
            entityItem.children = entityDetails;
            entityItem.contextValue = "entity";

            // ✅ Thêm sự kiện click để tìm trong file đang mở
            entityItem.command = {
              command: "structureView.searchInCurrentFile",
              title: "Search Class",
              arguments: [importName],
            };

            // ✅ Gom nhóm dựa theo hậu tố
            if (importName.endsWith("Entity")) {
              groupedItems["Entity"].push(entityItem);
            } else if (importName.endsWith("Dto")) {
              groupedItems["Dto"].push(entityItem);
            } else if (importName.endsWith("Type")) {
              groupedItems["Type"].push(entityItem);
            } else if (importName.endsWith("Enum")) {
              groupedItems["Enum"].push(entityItem);
            } else {
              groupedItems["Other"].push(entityItem);
            }
          }
        }
      });
    });

    console.log("-----------------------------------------------");
    console.log("groupedItem", groupedItems);
    console.log("-----------------------------------------------");

    // ✅ Sắp xếp danh sách theo nhóm
    Object.keys(groupedItems).forEach((group) => {
      if (groupedItems[group].length > 0) {
        const groupItem = new StructureItem(
          `📂 ${group}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          "folder"
        );
        groupItem.children = groupedItems[group];
        structure.push(groupItem);
      }
    });

    console.log("-----------------------------------------------");
    console.log("parse structure: structure", structure);
    console.log("-----------------------------------------------");

    this.allEntities = structure; // ✅ Lưu toàn bộ danh sách DTO/Entity để lọc
    return structure;
  }

  /** ✅ Hàm lấy thông tin của Entity/Enum */
  private getEntityOrEnumDetails(
    filePath: string,
    name: string
  ): StructureItem[] {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const entityClass = sourceFile.getClass(name);
    const enumDecl = sourceFile.getEnum(name);

    if (entityClass) {
      return entityClass.getProperties().map((prop) => {
        return new StructureItem(
          `🔹 ${prop.getName()}: ${prop.getType().getText()}`,
          vscode.TreeItemCollapsibleState.None,
          "property"
        );
      });
    }

    if (enumDecl) {
      return enumDecl.getMembers().map((member) => {
        return new StructureItem(
          `🔸 ${member.getName()} = ${member.getValue()}`,
          vscode.TreeItemCollapsibleState.None,
          "enum-member"
        );
      });
    }

    return [];
  }
}

export class StructureItem extends vscode.TreeItem {
  children: StructureItem[] = [];

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode
      .TreeItemCollapsibleState.None,
    icon: string
  ) {
    super(label, collapsibleState);
  }
}
// TODO: check compare not work
// TODO: unpin not work
