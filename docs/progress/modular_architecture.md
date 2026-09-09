# 功能進度紀錄：模組化多頁架構重構 (Modular Multi-Page Architecture)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  原本 RunBoard 為單檔集中式架構（`index.html` 單檔 852 行，包含所有 CSS 樣式、分頁狀態切換、各功能 HTML 與全域 JavaScript 邏輯）。為提升專案維護性、擴充性與模組隔離度，參照 `D:\Private\CPE_Tool` 的設計風格，將各項功能拆分為專屬的 HTML 與 JS，並將共用樣式、側邊導覽列與對話框組件化；同時解決跨頁面 File System API 連線遺失問題，導入 IndexedDB 持久化檔案授權。

---

## 已完成事項清單

- [x] **共用樣式庫抽離 (`css/style.css`)**：
  - 統一暗色系 Design Tokens（背景色、卡片、文字層級、狀態色彩）。
  - 收攏側邊欄、卡片、便條紙、任務狀態標籤、密碼區與彈跳視窗 (Modal) 樣式。
  - 新增首頁儀表板網格卡片樣式。
- [x] **跨頁檔案連線核心實作 (`js/storage.js`)**：
  - 封裝 File System Access API 讀寫 `data.json` 檔案。
  - 導入 IndexedDB 快取 `FileSystemFileHandle`，換頁自動還原檔案連線與資料讀取。
  - 處理權限查詢 (`queryPermission`) 與授權提示 UI 狀態輪轉。
- [x] **側邊導覽列組件化 (`js/nav.js`)**：
  - 參照 CPE_Tool 設計，動態掃描 `<div id="sidebar"></div>` 並注入標準側邊選單。
  - 自動依據 `window.location.pathname` 高亮作用中 (active) 項目。
  - 整合即時檔案連線狀態區（綠燈已連線、黃燈待授權、紅燈未連線）。
- [x] **共用對話框模組化 (`js/modal.js`)**：
  - 封裝通用 `Modal.open({ title, html, onConfirm })` 與 `Modal.close()`。
  - 支援自動聚焦輸入框、Enter 快捷送出、Escape 與點擊遮罩關閉。
- [x] **常用網站獨立模組 (`favorites.html` + `js/favorites.js`)**：
  - 分類折疊收合與狀態記憶。
  - 支援項目跨分類拖曳移動與分類排序。
  - 分類與網站項目的新增、編輯、刪除 CRUD。
- [x] **便條紙獨立模組 (`notes.html` + `js/notes.js`)**：
  - 便條紙顏色選擇器與背景自訂。
  - 支援便條紙尺寸調整（監聽 `mouseup` 自動儲存寬高至 `data.json`）。
  - 分類與便條紙的拖曳排序與 CRUD。
- [x] **任務清單獨立模組 (`tasks.html` + `js/tasks.js`)**：
  - 任務狀態三段輪轉（未開始 ➔ 進行中 ➔ 完成劃線）。
  - 支援任務項目跨分類拖曳排序與 CRUD。
- [x] **密碼區獨立模組 (`passwords.html` + `js/passwords.js`)**：
  - 密碼星號遮罩切換點閱。
  - 剪貼簿一鍵複製密碼與綠色回饋狀態。
  - 密碼項目新增與刪除。
- [x] **首頁總覽儀表板 (`index.html` + `js/index.js`)**：
  - 升級為工作區 Dashboard，自動彙整常用網站數量、便條數量、任務進度（進行中/已完成）與密碼數量。
  - 提供快速傳送門導向各工具頁面。

---

## 待辦事項 / 已知問題

- [ ] **主題切換系統 (Theme Switcher)**：
  - 可參考 CPE_Tool 的 `theme.js`，於側邊欄加入多種科技暗色主題切換（如 Slate、Cyber、Navy、Matrix）。
- [ ] **搜尋與篩選功能**：
  - 在常用網站與密碼區加入即時關鍵字搜尋與過濾機制。
- [ ] **離線備份與匯出**：
  - 增加一鍵手動匯出 `data.json` 備份檔功能，防止誤刪或瀏覽器快取異常。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 全域樣式 | 集中定義色彩變數、排版、按鈕、各卡片類型與動畫樣式 |
| [js/storage.js](file:///d:/Private/Runboard/js/storage.js) | 核心資料層 | 透過 File System API 讀寫 `data.json` 並以 IndexedDB 實現跨頁連線記憶 |
| [js/nav.js](file:///d:/Private/Runboard/js/nav.js) | 導覽組件 | 自動產生側邊選單、高亮當前頁面、動態掛載檔案狀態欄 |
| [js/modal.js](file:///d:/Private/Runboard/js/modal.js) | 互動組件 | 通用彈跳視窗控制器，提供非同步表單驗證與儲存回呼 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 儀表板總覽介面，展示各模組統計數字與快速入口 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 計算並渲染常用網站、便條、任務與密碼之統計摘要 |
| [favorites.html](file:///d:/Private/Runboard/favorites.html) | 視圖頁面 | 常用網站介面結構 |
| [js/favorites.js](file:///d:/Private/Runboard/js/favorites.js) | 業務邏輯 | 常用網站分類收合、卡片拖曳與 CRUD 操作 |
| [notes.html](file:///d:/Private/Runboard/notes.html) | 視圖頁面 | 便條紙介面結構 |
| [js/notes.js](file:///d:/Private/Runboard/js/notes.js) | 業務邏輯 | 便條紙顏色、大小調整監聽、拖曳與 CRUD 操作 |
| [tasks.html](file:///d:/Private/Runboard/tasks.html) | 視圖頁面 | 任務清單介面結構 |
| [js/tasks.js](file:///d:/Private/Runboard/js/tasks.js) | 業務邏輯 | 任務三段狀態切換、拖曳排序與 CRUD 操作 |
| [passwords.html](file:///d:/Private/Runboard/passwords.html) | 視圖頁面 | 密碼管理介面結構 |
| [js/passwords.js](file:///d:/Private/Runboard/js/passwords.js) | 業務邏輯 | 密碼顯示/隱藏遮罩切換、一鍵複製與 CRUD 操作 |
| [data.json](file:///d:/Private/Runboard/data.json) | 資料來源 | 儲存所有分類與項目的 JSON 本地資料檔 |
