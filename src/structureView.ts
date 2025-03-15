import * as vscode from "vscode";
import {
  Project,
  SourceFile,
  ClassDeclaration,
  EnumDeclaration,
  SyntaxKind,
} from "ts-morph";

export class StructureTreeProvider
  implements vscode.TreeDataProvider<StructureItem>
{
  private _onDidChangeTreeData: vscode.EventEmitter<
    StructureItem | undefined | void
  > = new vscode.EventEmitter<StructureItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<StructureItem | undefined | void> =
    this._onDidChangeTreeData.event;

  private currentFilePath: string | null = null;
  private selectedComparisons: StructureItem[] = []; // Lưu danh sách các DTO/Entity được chọn để so sánh
  private hasCompare = false;
  private allEntities: StructureItem[] = []; // Lưu trữ tất cả DTO/Entity
  private filteredEntities: StructureItem[] = []; // Lưu trữ kết quả lọc
  private filterText: string | null = null; // Chuỗi tìm kiếm hiện tại
  private searchIndexMap: Map<string, number> = new Map(); // Lưu vị trí hiện tại của từng class

  private pinnedEntities: Map<string, StructureItem> = new Map();
  private project = new Project();

  constructor() {
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
    if (!this.allEntities || this.allEntities.length === 0) {
      console.warn("⚠️ No entities found. Skipping refresh.");
      return;
    }

    setTimeout(() => this._onDidChangeTreeData.fire(), 100); // ✅ Tránh lỗi UI bị treo
  }

  /** 🔄 Refresh Structure View - Reset toàn bộ trạng thái */
  refreshStructure(): void {
    this.pinnedEntities.clear();
    this.selectedComparisons = [];
    this.hasCompare = false;
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
    if (!entity.label) {
      console.warn("⚠️ Entity has no label!");
      return;
    }

    if (entity.contextValue === "folder") {
      console.warn("⚠️ Skipping folder:", entity.label);
      return;
    }

    const rawLabel = entity.label.toString().replace(/^🔍 📦\s*/, ""); // ✅ Xóa tiền tố "🔍 📦 "

    // Kiểm tra xem entity đã tồn tại trong danh sách chưa
    if (
      this.selectedComparisons.some((item) => {
        const labelText =
          typeof item.label === "string" ? item.label : item.label?.label;
        return labelText?.replace(/^🔍 📦\s*/, "") === rawLabel;
      })
    ) {
      console.warn("⚠️ Entity already exists in comparison list!");
      return;
    }

    if (this.hasCompare || this.selectedComparisons.length >= 2) {
      this.selectedComparisons = []; // clear
      this.hasCompare = false;
      this.addEntityToComparison(entity);
      this.refresh();
      return;
    }

    const comparisonEntity = new StructureItem(
      `🔍 ${rawLabel}`,
      vscode.TreeItemCollapsibleState.Collapsed,
      "compare"
    );
    comparisonEntity.children = entity.children;

    this.selectedComparisons.push(comparisonEntity);

    if (this.selectedComparisons.length === 2) {
      this.compareEntities();
    }
    this.refresh();
  }

  compareEntities() {
    if (this.selectedComparisons.length !== 2) {
      console.warn("⚠️ Need exactly 2 entities to compare!");
      return;
    }

    const [entityA, entityB] = this.selectedComparisons;

    // Lấy danh sách thuộc tính của từng entity
    const propertiesA = new Set(entityA.children.map((child) => child.label));
    const propertiesB = new Set(entityB.children.map((child) => child.label));

    // ✅ Thuộc tính giống nhau
    const commonProperties = [...propertiesA].filter((prop) =>
      propertiesB.has(prop)
    );

    // ✅ Thuộc tính khác nhau
    const uniqueA = [...propertiesA].filter((prop) => !propertiesB.has(prop));
    const uniqueB = [...propertiesB].filter((prop) => !propertiesA.has(prop));

    // ✅ Hiển thị kết quả trong Tree View
    const comparisonResult = new StructureItem(
      "🔍 Comparison Result",
      vscode.TreeItemCollapsibleState.Expanded,
      "comparison"
    );

    comparisonResult.children = [
      new StructureItem(
        `✅ Common Properties (${commonProperties.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        "common"
      ),
      ...commonProperties.map(
        (prop) =>
          new StructureItem(
            `✔️ ${prop}`,
            vscode.TreeItemCollapsibleState.None,
            "property"
          )
      ),

      new StructureItem(
        `󠁯🟩 ${entityA.label} (${uniqueA.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        "uniqueA"
      ),
      ...uniqueA.map(
        (prop) =>
          new StructureItem(
            `${prop}`,
            vscode.TreeItemCollapsibleState.None,
            "property"
          )
      ),

      new StructureItem(
        `🟥 ${entityB.label} (${uniqueB.length})`,
        vscode.TreeItemCollapsibleState.Collapsed,
        "uniqueB"
      ),
      ...uniqueB.map(
        (prop) =>
          new StructureItem(
            `${prop}`,
            vscode.TreeItemCollapsibleState.None,
            "property"
          )
      ),
    ];

    this.selectedComparisons = [comparisonResult]; // ✅ Thay danh sách so sánh bằng kết quả
    this.hasCompare = true;
    this.refresh();
  }

  clearComparison() {
    this.selectedComparisons = []; // ✅ Xóa toàn bộ danh sách so sánh
    this.refresh();
  }

  clearFilter() {
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
          return;
        }
        this.applyFilter(input.trim());
      });
  }

  /** ✅ Hàm riêng để áp dụng bộ lọc */
  private applyFilter(filterText: string) {
    this.filterText = filterText.toLowerCase();
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
        this.refresh();
      }
    }
  }

  getTreeItem(element: StructureItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: StructureItem): Thenable<StructureItem[]> {
    if (!this.currentFilePath) {
      console.warn("⚠️ No active file. Returning empty tree.");
      return Promise.resolve([
        new StructureItem(
          "📂 Open a TypeScript file",
          vscode.TreeItemCollapsibleState.None,
          "info"
        ),
      ]);
    }

    if (!element) {
      let rootItems = [
        ...this.pinnedEntities.values(),
        ...this.parseStructure(this.currentFilePath),
      ];

      // ✅ Hiển thị kết quả so sánh nếu có
      if (this.selectedComparisons.length > 0) {
        rootItems.push(...this.selectedComparisons);
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
          `🔹 ${prop.getName()} ${simplifyTypeName(prop.getType().getText())}`,
          vscode.TreeItemCollapsibleState.None,
          "property"
        );
      });
    }

    if (enumDecl) {
      return enumDecl.getMembers().map((member) => {
        return new StructureItem(
          `🔸 ${member.getName()} = "${member.getValue()}"`,
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

function simplifyTypeName(type: string): string {
  // Nếu là kiểu import(), trích xuất tên cuối cùng sau dấu "."
  const importRegex = /import\(".*"\)\.(\w+)/;
  const match = type.match(importRegex);
  if (match) {
    return ` : {${match[1]}}`; // Ghi chú là kiểu được import
  }

  // Nếu là kiểu cơ bản (string, number, boolean, etc.)
  if (["string", "number", "boolean", "Date"].includes(type)) {
    return ` : [${type}]`; // Đánh dấu kiểu dữ liệu
  }

  return ` : (${type})`; // Trả về mặc định nếu không cần rút gọn
}
