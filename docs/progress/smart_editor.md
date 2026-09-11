# 紀錄時間：2026-09-11

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」升級至 3.0，實現「資料視圖專用化 (Context-Aware Viewports)」與「靈活版面配置 (Adaptive Layout)」。
徹底解決右側固定 30% 面板佔用空間的痛點，將滿版視野還給使用者。針對不同格式的本質特性，提供專屬的閱讀與編輯交互體驗（Word A4 擬真紙張、CSV/Excel 現代資料表格、Markdown 可拖拉雙欄即時對照、JSON 樹狀視覺化節點編輯）。

## 已完成事項清單
- [x] **釋放 100% 視野**：移除常駐右側面板，單一檔案（Excel, Word, CSV, 純代碼）預設享有 100% 滿版無干擾視野。
- [x] **滑出式搜尋抽屜 (Search Drawer)**：支援點擊頂部按鈕或按鍵盤快捷鍵 `Ctrl + F` / `Esc` 平滑滑出與收合，兼顧快速過濾與閱讀體驗。
- [x] **Markdown 雙欄可拖拉即時對照 (Split View with Resizer)**：
  - 打開 `.md` 時自動切換為左欄（CodeMirror 代碼編輯）+ 右欄（Marked.js HTML 即時預覽）。
  - 實作 `.split-resizer` 滑鼠拖拉調節比例功能（15% ~ 85% 範圍限制）。
  - CodeMirror 輸入內容時，右側預覽即時自動更新。
- [x] **JSON 專用樹狀視覺化編輯器 (JSONEditor)**：
  - 引入 JSONEditor CDN。
  - 打開 `.json` 時自動呈現為層級樹狀節點（支援展開折疊、雙擊修改 Key/Value、型態防呆）。
  - 提供「🔄 切換原始碼/樹狀」按鈕，在純代碼與視覺化節點之間雙向無縫互轉並支援儲存回本機。
- [x] **CSV & Excel 專用試算表視圖 (Tabulator)**：
  - 引入 Tabulator Midnight 深色主題。
  - 支援凍結表頭 (Sticky Header)、點擊表頭排序 (Sort)、斑馬紋與滑鼠 Hover 高亮。
  - **CSV 雙向編輯與序列化**：可直接雙擊儲存格編輯，按下儲存自動轉回標準 RFC 4180 CSV 格式寫回本機，並提供「切換原始碼」按鈕。
- [x] **Word 專用 A4 文件視圖 (Mammoth.js)**：
  - 實作 `.doc-paper` 居中 A4 擬真紙張容器，具備標準印刷邊距、陰影與專屬字型。

## 操作快捷鍵與交互清單
- `Ctrl + F` / `Cmd + F`：開啟右側搜尋抽屜。
- `Esc`：關閉搜尋抽屜。
- `Markdown 分隔線拖曳`：滑鼠左鍵按住中間分隔線左右拖動，即可即時調整編輯與預覽視窗比例。

## 核心檔案對照表
- `smart_editor.html`：主視圖骨架，整合 CodeMirror, Tabulator, JSONEditor, Marked, SheetJS, Mammoth 六大 CDN 資源。
- `css/smart_editor.css`：定義拖拉分隔條 (`.split-resizer`)、滿版檢視區塊、A4 文件擬真紙張與搜尋抽屜樣式。
- `js/smart_editor.js`：核心邏輯控制中心（包含格式路由、滑鼠拖拉計算、Markdown 即時同步、JSON 樹狀雙向綁定、CSV 序列化與快捷鍵監聽）。
- `js/nav.js`：全域側邊導覽列註冊處。
