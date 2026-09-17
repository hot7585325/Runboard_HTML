# 紀錄時間：2026-09-17

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」的 CSV 試算表視圖升級為支援「動態新增/刪除欄列 (Dynamic Columns & Rows)」。
免除使用者過去必須切換回純文字原始碼才能修改欄位數或增減列的不便，提供頂部工具列快捷鍵、雙擊重新命名標題與右鍵選單功能，並健全 RFC 4180 CSV 格式雙向序列化回存機制。

## 已完成事項清單
- [x] **CSV 專用動態欄列工具列按鈕**：
  - `➕ 新增列`：於表格底部即時插入空白列並捲動聚焦。
  - `➕ 新增欄`：彈窗詢問欄位標題，自動於最右側加入新欄並使各列皆可輸入。
- [x] **表頭就地重新命名 (Editable Title)**：
  - 啟用 Tabulator 的 `editableTitle: true`，使用者可直接雙擊欄位標題修改名稱。
- [x] **滑鼠右鍵選單 (Context Menu)**：
  - 資料列右鍵：提供「➕ 在下方插入新列」與「🗑️ 刪除此列」。
  - 欄位標題右鍵：提供「🗑️ 刪除此欄」（附確認防誤刪機制）。
- [x] **智慧雙向同步與存檔 (`syncTabulatorToCodeMirror`)**：
  - 動態收集最新欄位（包含新欄、刪除欄、修改名稱後的標題）與列資料，序列化為標準 CSV 字串寫回 CodeMirror 與本機實體檔案。
- [x] **雙入口新建系統 (MD / CSV / JSON / TXT 初始範本)**。
- [x] **智慧另存新檔流程 (`showSaveFilePicker`)**。
- [x] **釋放 100% 滿版視野與滑出式搜尋抽屜 (`Ctrl + F` / `Esc`)**。
- [x] **Markdown 雙欄可拖拉即時對照 (Split View with Resizer)**。
- [x] **JSON 專用樹狀視覺化編輯器 (JSONEditor)**。
- [x] **Word 專用 A4 文件視圖 (Mammoth.js)**。

## 操作快捷鍵與交互清單
- `Ctrl + F` / `Cmd + F`：開啟右側搜尋抽屜。
- `Esc`：關閉搜尋抽屜。
- `➕ 新增檔案 ▾`：頂部隨時開新檔案。
- `Markdown 分隔線拖曳`：按住中間 Resizer 左右拖動調節比例。
- `CSV 雙擊表頭`：直接修改欄位標題。
- `CSV 列/欄右鍵選單`：插入列或刪除列/欄。

## 核心檔案對照表
- `smart_editor.html`：頁面骨架（新增 CSV 欄列操作按鈕）。
- `css/smart_editor.css`：定義 Tabulator 右鍵選單樣式 (`.tabulator-menu`) 與表頭編輯輸入框樣式。
- `js/smart_editor.js`：核心邏輯中心（包含 `addCsvRow`, `addCsvColumn`, 表頭編輯監聽, 右鍵選單與 `syncTabulatorToCodeMirror`）。
- `js/nav.js`：全域側邊導覽列。
