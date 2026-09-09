# 本機端資料驅動網頁工具開發規範 (Serverless Stateful Tool Guidelines)

本規範定義了開發本機端 (`file:///` 協定) 免伺服器網頁工具的架構標準，確保在離線環境具備高度擴充性、安全防禦與順暢的跨頁資料體驗。

## 1. 原生多頁與防禦機制 (Architecture & Defenses)
- **嚴禁 SPA 切換與 Iframe**：在 `file:///` 協定下，`iframe` 會被瀏覽器判定為跨域，導致 `File System Access API` (如 `window.showOpenFilePicker`) 被阻擋。功能切換一律採用標準 HTML 超連結 `<a href="page.html">` 進行整頁頂層跳轉。
- **純原生多頁架構**：每個獨立功能必須是獨立的實體 HTML 檔案（例如 `index.html`、`favorites.html`、`notes.html`、`tasks.html`、`passwords.html`）。
- **嚴禁使用 ES Module**：切勿使用 `import/export` 或 `<script type="module">`，因為在 `file:///` 環境下會被瀏覽器的 CORS 安全機制阻擋。一律使用標準 `<script src="...">` 載入，並使用 IIFE 模組化避免污染全域。
- **離線優先 (Offline-First)**：避免引用外部 CDN（如 cdnjs, unpkg），第三方套件需下載至本機 `lib/` 或 `vendor/`，確保在無網路環境下穩定運行。

## 2. 跨頁資料持久化 (Stateful Data Layer)
- **資料中心化**：專案資料統一集中管理（如 `data.json`）。
- **IndexedDB 記憶授權**：必須由共用的 `js/storage.js` 封裝 File System Access API，並使用 `IndexedDB` 序列化快取 `FileSystemFileHandle`。換頁時由 `Storage.init()` 自動還原連線，免除重複選檔問題。
- **狀態防禦與提示**：未連線或權限逾期時，統一透過 `Storage` 模組切換 `#no-data-msg` 與 `#app-container` 容器顯示，並在側邊欄指示燈提示一鍵恢復授權。

## 3. 共用基礎組件 (Shared Components)
- **樣式 (CSS)**：所有頁面共用 `css/style.css`，統一管理 Design Tokens（色彩、間距、圓角、現代暗色主題）。
- **導覽列 (Nav)**：統一由 `js/nav.js` 自動渲染到 `<div id="sidebar"></div>`，自動偵測當前檔名並高亮 active 項目，整合即時連線指示燈。
- **對話框 (Modal)**：表單輸入/編輯一律調用共用 `js/modal.js`（`Modal.open(...)`），禁止手刻獨立 dialog 或原生 prompt。
- **首頁儀表板 (Dashboard)**：`index.html` 應作為工作區概覽，即時讀取資料並以卡片統計各模組關鍵數據與傳送門。
- **腳本分離 (JS)**：每個工具頁面應有自己專屬的 JS 檔案（例如 `favorites.html` 對應 `js/favorites.js`），職責單一不混淆。

## 4. 新增功能頁面 SOP 檢核表 (New Feature Checklist)
每當新增功能（例如 `my_tool.html`）時，必須嚴格遵守以下步驟：
1. **HTML 結構**：
   - `<head>` 依序引入：
     ```html
     <link rel="stylesheet" href="css/style.css">
     <script src="js/storage.js"></script>
     <script src="js/nav.js"></script>
     <script src="js/modal.js"></script>
     ```
   - `<body>` 必須包含：
     - `<div id="sidebar"></div>`
     - `<div class="main-content">` 內含 `#no-data-msg`（未連線提示）與 `#app-container`（主內容區）。
   - 結尾引入專屬邏輯 `<script src="js/my_tool.js"></script>`。
2. **註冊導覽**：在 `js/nav.js` 的 `NAV_ITEMS` 加入新工具名稱與路徑。
3. **專屬邏輯**：建立 `js/my_tool.js`，以 IIFE 封裝，並於 `DOMContentLoaded` 調用 `Storage.init()` 進行資料初始化與渲染。
