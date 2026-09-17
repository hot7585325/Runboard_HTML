# 紀錄時間：2026-09-17

## 當前目標與背景
將「通用檔案編輯器 (Smart Editor)」進行架構重構（方案一：原生多頁子頁籤架構），徹底解決單一頁面載入過多 CDN (6大函式庫) 與代碼耦合 (超過 800 行) 的問題。
遵循 `GEMINI.md` 的「純原生多頁架構」規範，左側側邊欄維持單一「✨ 通用編輯器」入口，主畫面頂部 10% 建立統一的子分頁導覽列 (Sub-Tabs Bar)，將各檔案格式拆分為獨立實體 HTML/JS/CSS，各頁面僅載入自身所需的 CDN，達到極致的開啟速度與維護性。

## 已完成事項清單
- [x] **側邊欄單一入口與智慧高亮 (`js/nav.js`)**：
  - 側邊欄維持「✨ 通用編輯器」，內部支援所有 `editor_*.html` 子頁面自動維持 active 高亮狀態。
- [x] **共用子分頁與工具列樣式 (`css/editor_common.css`)**：
  - 定義頂部 10% 子分頁導覽列 (`.sub-nav-bar`, `.sub-tab`)、通用按鈕、搜尋抽屜與首頁儀表板卡片樣式。
- [x] **CSV 專用頁面 (`editor_csv.html` + `js/editor_csv.js` + `css/editor_csv.css`)**：
  - 僅載入 Tabulator CDN，專責動態增刪欄列、雙擊重命名表頭、右鍵選單、試算表儲存格編輯與 RFC 4180 CSV 存取。
- [x] **Markdown 專用頁面 (`editor_md.html` + `js/editor_md.js` + `css/editor_md.css`)**：
  - 僅載入 CodeMirror (Markdown) + Marked.js，專責雙欄拖拉 Resizer、即時同步渲染、文字搜尋與行號跳轉。
- [x] **JSON 專用頁面 (`editor_json.html` + `js/editor_json.js` + `css/editor_json.css`)**：
  - 僅載入 JSONEditor + CodeMirror，專責樹狀節點折疊展開、Key/Value 就地修改、一鍵格式化排版與代碼互轉存檔。
- [x] **Office 檢視專用頁面 (`editor_doc.html` + `js/editor_doc.js` + `css/editor_doc.css`)**：
  - 僅載入 Mammoth.js + SheetJS + Tabulator，專責 Word A4 擬真紙張閱讀與 Excel 凍結表頭試算表唯讀檢視。
- [x] **總覽首頁與智慧路由器 (`smart_editor.html` + `js/smart_editor.js`)**：
  - 零外部 CDN 依賴，秒開首頁。提供四大格式快速入口卡片與「智慧開啟本機檔案」路由器。
- [x] **深色主題與體驗優化**：
  - Markdown 預覽區與 JSON 樹狀檢視全站全面適配深色主題 (`#1e1e1e` / `#252526`)，視覺協調一致。
  - 移除進入頁面強制填入預設範本之邏輯，預設開啟全新空白檔案；並在工具列新增獨立「📋 載入範本」按鈕供手動調用。
- [x] **跨格式切換雙重防護機制 (Dual-Protection System)**：
  - **即時草稿自動暫存 (`LocalStorage`)**：Markdown、CSV、JSON 在使用者輸入時自動寫入瀏覽器快取，切換頁面或重整後自動還原內容並提示 `(已自動還原草稿)`。存檔或建立新檔後自動清除。
  - **離開頁面防呆攔截 (`Navigation Guard`)**：監聽 `beforeunload` 與頂部子分頁超連結點擊，若有未存檔修改即時跳出警示確認，防止誤觸丟失工作內容。

## 待辦事項 / 已知問題
- [ ] 支援更多代碼格式預覽（如 XML、YAML 等純文字語言模式）。
- [ ] 探索 Office (docx / xlsx) 的輕量編輯保存可能性（目前僅唯讀檢視）。

## 核心檔案對照表
- `smart_editor.html` + `js/smart_editor.js`：總覽儀表板與副檔名智慧快開路由器。
- `editor_csv.html` + `js/editor_csv.js` + `css/editor_csv.css`：CSV 試算表格與草稿保護。
- `editor_md.html` + `js/editor_md.js` + `css/editor_md.css`：Markdown 雙欄筆記與草稿保護。
- `editor_json.html` + `js/editor_json.js` + `css/editor_json.css`：JSON 樹狀結構與草稿保護。
- `editor_doc.html` + `js/editor_doc.js` + `css/editor_doc.css`：Office 文件檢視。
- `css/editor_common.css`：頂部 10% 子分頁、工具列按鈕與搜尋抽屜共用樣式。
- `js/nav.js`：全域側邊導覽列（包含編輯器子頁面高亮適配）。
