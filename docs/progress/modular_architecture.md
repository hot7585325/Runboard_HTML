# 功能進度紀錄：模組化多頁架構重構與全模組功能升級 (Modular Architecture & Feature Enhancements)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  Runboard 已成功自單檔架構遷移為純原生多頁式架構（Native Multi-Page Application）。為進一步解決各模組的操作盲點、提升使用者體驗與保障離線資料可靠性，本次針對「密碼管理」、「常用網站」、「任務清單」、「便條紙」及「核心儲存層」進行全方位功能優化與升級，並嚴格維持 `GEMINI.md` 所規範之離線優先、無 ES Module、共用對話框與原生多頁防禦機制。

---

## 已完成事項清單

- [x] **基礎架構與共用組件**：
  - 共用暗色系樣式庫抽離 (`css/style.css`)，定義標準 Design Tokens、卡片排版與互動反饋。
  - 擴充共用搜尋工具列 (`.toolbar-container`, `.search-bar`, `.search-input`)、按鈕樣式與拖曳指示高光。
  - 動態側邊導覽列 (`js/nav.js`)，支援頁面自動偵測 active 高亮與動態連線狀態區域。
  - 共用彈跳對話框模組 (`js/modal.js`)，支援 Esc/Enter 快捷操作與焦點自動定位。
  - 首頁儀表板 (`index.html` + `js/index.js`) 彙整統計卡片與各工具快速傳送門。
- [x] **核心儲存層與備份防護 (`js/storage.js`)**：
  - File System Access API 整合 IndexedDB 實現檔案 Handle 快取與跨頁面自動恢復授權。
  - 新增 `Storage.exportBackup()`：一鍵匯出帶時間戳記的備份檔 (`runboard_backup_YYYYMMDD_HHmmss.json`)，以原生 Blob 機制觸發瀏覽器下載。
  - 側邊欄整合「📥 匯出備份檔」與「切換資料檔」功能。
- [x] **常用網站模組升級 (`favorites.html` + `js/favorites.js`)**：
  - 整合 Google Favicon 服務自動抓取網站圖示，支援連線失敗容錯隱藏。
  - 新增頂部即時搜尋框，依標題、網址、說明及分類即時過濾。
  - 增強拖曳功能：全面支援**同分類內順序調整**與跨分類精確移動。
- [x] **任務清單模組升級 (`tasks.html` + `js/tasks.js`)**：
  - 任務內容即時關鍵字搜尋過濾。
  - 分類標題旁動態顯示「已完成 X/Y」徽章，全數完成時自動高亮綠色標籤。
  - 工具列增加「隱藏已完成 (Hide Done)」切換開關，一鍵收攏已達成項目。
  - 任務項目支援**同分類內上下拖曳排序**與跨分類拖曳。
- [x] **便條紙模組升級 (`notes.html` + `js/notes.js`)**：
  - 便條紙文字內容即時搜尋過濾。
  - 支援 URL 自動轉超連結：透過安全正則解析 `http/https` 網址並轉為新分頁開啟連結，搭配 `escapeHtml` 杜絕 XSS 風險。
  - 支援便條紙卡片**同分類內拖曳重新排序**。
  - 保留便條紙尺寸自由縮放與背景色彩記憶功能。
- [x] **密碼管理模組升級 (`passwords.html` + `js/passwords.js`)**：
  - 平台與帳號即時搜尋過濾。
  - 補齊「✏️ 編輯密碼」功能：點擊彈出共用 Modal 進行更新。
  - 內建「⚡ 隨機強密碼產生器」：採用 `crypto.getRandomValues` 安全亂數生成 16 碼英數特殊字元強密碼。
  - 密碼遮罩點擊查看、一鍵複製剪貼簿回饋與輸入文字跳脫防護。

---

## 待辦事項 / 已知問題

- [ ] **主題切換系統 (Theme Switcher)**：
  - 參考 `CPE_Tool` 的 `theme.js`，於側邊欄提供 Slate、Cyber、Navy、Matrix 等科技暗色主題切換。
- [ ] **密碼主密碼加密 (Master Password / AES-GCM)**：
  - 透過 Web Crypto API 導入使用者自訂主密碼，於寫入 `data.json` 前加密敏感欄位，解鎖後方可查看明文。
- [ ] **跨分頁即時同步廣播 (BroadcastChannel)**：
  - 當多個分頁同時開啟時，透過 `BroadcastChannel` 同步資料變更，避免各自編輯造成存檔覆蓋。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 全域樣式 | 集中定義色彩變數、工具列、搜尋框、Favicon、進度標籤與拖曳動畫 |
| [js/storage.js](file:///d:/Private/Runboard/js/storage.js) | 核心資料層 | 讀寫 `data.json`、快取 Handle、連線狀態 UI 與一鍵匯出備份檔 |
| [js/nav.js](file:///d:/Private/Runboard/js/nav.js) | 導覽組件 | 自動產生側邊選單、高亮當前頁面、動態掛載檔案狀態與備份按鈕 |
| [js/modal.js](file:///d:/Private/Runboard/js/modal.js) | 互動組件 | 通用彈跳視窗控制器，提供非同步表單驗證與儲存回呼 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 儀表板總覽介面，展示各模組統計數字與快速入口 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 計算並渲染常用網站、便條、任務與密碼之統計摘要 |
| [favorites.html](file:///d:/Private/Runboard/favorites.html) | 常用網站視圖 | 常用網站介面結構與搜尋工具列 |
| [js/favorites.js](file:///d:/Private/Runboard/js/favorites.js) | 常用網站邏輯 | Favicon 自動抓取、即時搜尋、同分類/跨分類拖曳與 CRUD 操作 |
| [notes.html](file:///d:/Private/Runboard/notes.html) | 便條紙視圖 | 便條紙介面結構與搜尋工具列 |
| [js/notes.js](file:///d:/Private/Runboard/js/notes.js) | 便條紙邏輯 | 便條紙即時搜尋、URL 超連結轉換、同分類拖曳與 CRUD 操作 |
| [tasks.html](file:///d:/Private/Runboard/tasks.html) | 任務清單視圖 | 任務清單介面結構、搜尋列與「隱藏已完成」按鈕 |
| [js/tasks.js](file:///d:/Private/Runboard/js/tasks.js) | 任務清單邏輯 | 任務即時搜尋、完成進度標籤、隱藏已完成切換、同分類拖曳與 CRUD |
| [passwords.html](file:///d:/Private/Runboard/passwords.html) | 密碼管理視圖 | 密碼管理介面結構與搜尋框 |
| [js/passwords.js](file:///d:/Private/Runboard/js/passwords.js) | 密碼管理邏輯 | 密碼即時搜尋、編輯密碼、隨機強密碼生成、遮罩複製與 CRUD |
| [data.json](file:///d:/Private/Runboard/data.json) | 資料來源 | 儲存所有分類與項目的 JSON 本地資料檔 |
