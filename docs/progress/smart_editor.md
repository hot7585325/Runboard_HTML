# 紀錄時間：2026-09-11

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」升級至 2.0，實現「資料視圖專用化 (Context-Aware Viewports)」，針對人類大腦閱讀不同格式的直覺習慣進行介面定制，徹底解決 CSV/Excel 缺乏表格感與 Word 滿版失真的痛點。

## 已完成事項清單
- [x] 整合 **Tabulator (v5.5)** 現代化 Data Grid 引擎。
- [x] **Excel (.xlsx) 專用視圖**：二進位解析後直轉 Tabulator，提供凍結表頭、點擊排序、斑馬紋與動態搜尋。
- [x] **CSV (.csv) 專用視圖**：
  - 預設直接掛載為互動表格，支援**直接雙擊儲存格編輯**。
  - 實作雙向同步序列化引擎，編輯後直接按下「💾 儲存修改」即可產生標準 CSV 格式覆寫回本機實體檔案。
  - 提供「🔄 切換原始碼/表格」按鈕，兼顧視覺化與純文字批次編輯。
- [x] **Word (.docx) 專用視圖**：打造擬真居中 A4 紙張容器 (`.doc-paper`)，具備印刷級邊距、陰影與專屬文字字型。
- [x] **過濾引擎聯動**：在試算表模式下，搜尋框會直接觸發 Tabulator 的即時表格行篩選。

## 待辦事項 / 已知問題
- 暫無已知 Bug，格式切換與存檔測試順暢。

## 核心檔案對照表
- `smart_editor.html`：主頁面骨架，引入 Tabulator, CodeMirror, Marked, SheetJS, Mammoth 五大 CDN。
- `css/smart_editor.css`：定義 A4 紙張容器樣式 (`.doc-paper`, `.doc-viewport`) 與 Tabulator Midnight 深色主題覆寫。
- `js/smart_editor.js`：核心調度器（包含 CSV 解析/序列化、Tabulator 雙向綁定、CodeMirror 與各視圖動態切換）。
- `js/nav.js`：全域側邊導覽列。
