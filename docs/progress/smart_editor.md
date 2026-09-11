# 紀錄時間：2026-09-11

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」升級至 3.0，將版面還給使用者（移除右側常駐 30% 面板，改為滑出式搜尋抽屜），並針對 Markdown 實作可拖拉左右分割視窗即時預覽，以及為 JSON 檔案引入專屬樹狀視覺化編輯器 (JSONEditor)。

## 已完成事項清單
- [x] **釋放 100% 視野**：移除常駐右側面板，單一檔案（Excel, Word, CSV, 程式碼）全面享有滿版視野。
- [x] **滑出式搜尋抽屜 (Search Drawer)**：支援點擊頂部按鈕或按鍵盤快捷鍵 `Ctrl + F` / `Esc` 平滑滑出與收合，兼顧快速過濾與閱讀無干擾。
- [x] **Markdown 雙欄可拖拉即時對照**：
  - 打開 `.md` 時自動切換為雙欄視圖。
  - 實作 `.split-resizer` 滑鼠拖拉調節比例功能。
  - CodeMirror 輸入內容時，右側 Marked.js 預覽即時自動更新。
- [x] **JSON 樹狀視覺化編輯器 (JSONEditor)**：
  - 引入 JSONEditor CDN。
  - 打開 `.json` 時自動呈現為樹狀節點（可展開折疊、雙擊修改 Key/Value、型態防呆）。
  - 提供「🔄 切換原始碼/樹狀」雙向無縫互轉並支援存檔回本機。
- [x] **CSV/Excel 維持 Tabulator 現代表格體驗**。

## 待辦事項 / 已知問題
- 暫無已知 Bug，拖拉調整比例與格式切換流暢。

## 核心檔案對照表
- `smart_editor.html`：頁面骨架，移除常駐欄位，引入 JSONEditor CDN 與拖拉骨架。
- `css/smart_editor.css`：定義拖拉分隔線 (`.split-resizer`)、滿版檢視區塊與搜尋抽屜動畫 (`.search-drawer`)。
- `js/smart_editor.js`：核心邏輯（包含滑鼠拖拉計算、Markdown 即時同步、JSON 樹狀雙向綁定、快捷鍵監聽）。
- `js/nav.js`：全域側邊導覽列。
