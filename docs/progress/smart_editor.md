# 紀錄時間：2026-09-11

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」升級至完整創作工具，打破只能「讀取現有檔案修改」的限制，加入「從空白建立新檔案 (New File Creation)」能力。
支援 Markdown、CSV、JSON、純文字檔案的快速範本建立，並整合 `window.showSaveFilePicker()` 實現第一次儲存自動喚起本機「另存新檔」流程。

## 已完成事項清單
- [x] **雙入口新建系統**：
  - 首頁歡迎區新增 4 種格式的快速卡片建立按鈕。
  - 頂部工具列常駐「➕ 新增檔案 ▾」下拉式選單。
- [x] **各格式專屬初始範本**：
  - `MD`：自動初始化 Markdown 雙欄可拖拉視圖並填入基礎筆記結構。
  - `CSV`：自動啟動 Tabulator 試算表格，並預填標準資料表頭與範例列。
  - `JSON`：自動啟動 JSONEditor 樹狀視覺化節點並預載基礎 JSON 物件。
  - `TXT`：啟動空白 CodeMirror 編輯器。
- [x] **智慧另存新檔流程 (`showSaveFilePicker`)**：
  - 判定未存檔的新建狀態，首次點擊「💾 儲存修改」自動呼叫原生存檔對話框。
  - 儲存完成後自動綁定 Handle，後續編輯直接就地覆寫。
- [x] **釋放 100% 視野**：移除常駐右側面板，單一檔案（Excel, Word, CSV, 純代碼）預設享有 100% 滿版無干擾視野。
- [x] **滑出式搜尋抽屜 (Search Drawer)**：支援 `Ctrl + F` / `Esc` 平滑滑出與收合。
- [x] **Markdown 雙欄可拖拉即時對照 (Split View with Resizer)**。
- [x] **JSON 專用樹狀視覺化編輯器 (JSONEditor)**。
- [x] **CSV & Excel 專用試算表視圖 (Tabulator)**。
- [x] **Word 專用 A4 文件視圖 (Mammoth.js)**。

## 操作快捷鍵與交互清單
- `Ctrl + F` / `Cmd + F`：開啟右側搜尋抽屜。
- `Esc`：關閉搜尋抽屜。
- `➕ 新增檔案 ▾`：頂部隨時開新檔案。
- `Markdown 分隔線拖曳`：按住中間 Resizer 左右拖動調節比例。

## 核心檔案對照表
- `smart_editor.html`：頁面骨架（新增下拉選單結構、首頁快速建立卡片）。
- `css/smart_editor.css`：定義新建卡片視覺、下拉選單動畫與滿版佈局。
- `js/smart_editor.js`：核心邏輯中心（包含 `createNewFile` 範本載入、`showSaveFilePicker` 另存新檔、雙向同步等）。
- `js/nav.js`：全域側邊導覽列。
