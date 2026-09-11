# 功能進度紀錄：任務清單進階升級與歸檔匯出 (Tasks Details, Solutions & Archive Export)

- **紀錄時間**：2026-09-11
- **當前目標與背景**：
  為使任務清單能應對更複雜的工作追蹤與知識積累需求，本次進行全方位功能升級。支援設定開始日期排程、提供多行詳細內文描述、完成任務時錄入解法與踩坑覆盤心得，以及一鍵將已完成任務匯出為帶時間戳記的 Markdown 檔案（`已完成任務_YYYYMMDDHHmm.md`）並自清單清除。同時將匯出封存邏輯獨立拆分為 `js/tasks_export.js`，落實代碼解耦。

---

## 已完成事項清單

- [x] **排程開始時間支援 (`startDate`)**：
  - 新增/編輯視窗支援「開始日期」與「截止日期」雙日期輸入。
  - `getScheduleBadge()` 根據本地當前日期動態判斷：
    - 未到達開始日：提示「`⏳ 預計 MM/DD 開始`」。
    - 區間日程：顯示「`📅 MM/DD ~ MM/DD`」。
    - 逾期/今日到期/明天到期：維持多層級警示色彩。
- [x] **多行詳細說明 (`description`)**：
  - Modal 支援多行 `<textarea>` 輸入任務細節與驗收條件。
  - 卡片採用「預設單行折疊、點擊按鈕平滑展開」設計（`.btn-expand-details` + `.task-desc-box`），保持介面整潔。
- [x] **完成解法與覆盤備註 (`solution`)**：
  - 任務點擊切換為「完成」狀態時，主動提示記錄解法或踩坑心得。
  - 完成任務卡片附帶「`💡`」按鈕隨時編輯補登，卡片下方以柔和微綠區塊醒目展示（`.task-solution-box`）。
- [x] **一鍵歸檔與 Markdown 匯出 (`TasksExporter`)**：
  - 工具列掛載「`📦 歸檔並清除已完成`」按鈕。
  - 抓取本地時間自動格式化檔名：`已完成任務_YYYYMMDDHHmm.md`。
  - 結構化輸出分類、任務標題、排程區間、詳細內文與完成解法。
  - 純前端 Blob 下載完成後，自清單清除已完成項目並持久化存入 `data.json`。
- [x] **模組解耦與代碼拆分**：
  - 建立專屬模組 `js/tasks_export.js` 封裝匯出與清理邏輯。
  - 專屬樣式集中維護於 `css/tasks.css`，嚴格遵守免伺服器原生架構規範。

---

## 待辦事項 / 後續優化方向

- [ ] **任務優先級標記 (Priority)**：
  - 支援「高 🔴 / 中 🟡 / 低 🟢」優先級切換。
- [ ] **多維度篩選膠囊 (Filter Pills)**：
  - 於工具列增加「全部」、「已逾期」、「今天到期」、「進行中」快捷過濾按鈕。
- [ ] **分類底部行內快速新增 (Inline Quick Add)**：
  - 各分類底部常駐單行輸入框，按 Enter 快速建立下一筆任務。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [tasks.html](file:///d:/Private/Runboard/tasks.html) | 任務清單視圖 | 介面骨架、引入 `tasks_export.js`、工具列掛載歸檔按鈕 |
| [js/tasks.js](file:///d:/Private/Runboard/js/tasks.js) | 核心邏輯 | 任務與分類 CRUD、排程運算、詳情展開收合、解法錄入互動 |
| [js/tasks_export.js](file:///d:/Private/Runboard/js/tasks_export.js) | 獨立模組 | 專責已完成任務 Markdown 內容組裝、時間戳檔名生成、下載與清除存檔 |
| [css/tasks.css](file:///d:/Private/Runboard/css/tasks.css) | 專屬樣式 | 任務多行布局、詳情折疊盒、解法卡片、排程狀態與工具列按鈕樣式 |
| [data.json](file:///d:/Private/Runboard/data.json) | 本地資料 | 集中儲存包含 `startDate`, `dueDate`, `description`, `solution` 之 tasks 陣列 |
