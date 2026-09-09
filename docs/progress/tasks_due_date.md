# 功能進度紀錄：任務清單截止時間與逾期色彩警示 (Tasks Due Date & Overdue Alert)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  任務清單（Tasks）在具備分類管理、狀態切換、內容搜尋與拖曳排序等基礎功能後，為提升時效性管理與輕重緩急辨識度，本次新增「截止時間 (Due Date)」機制。系統能根據使用者本機當前日期，自動計算任務到期狀態並以階層化色彩徽章即時警示，同時將逾期指標同步整合至首頁儀表板，助使用者快速掌握緊急事項。

---

## 已完成事項清單

- [x] **任務截止日期支援 (Due Date Data Layer & Modal)**：
  - 新增/編輯任務彈跳視窗 (`js/modal.js`) 擴充選填之 `<input type="date">` 欄位。
  - 支援設定自訂期限或留空清除；資料持久化至 `data.json` 中的 `task.dueDate` (`YYYY-MM-DD`)。
  - 暗色主題日曆選擇圖示優化反色處理，確保在深色背景下清晰可見。
- [x] **動態多層級色彩警示徽章 (Visual Urgency Indicators)**：
  - **🔴 已逾期 (Overdue)**：截止日小於今日且狀態未完成，顯示醒目紅色徽章「`⚠️ 逾期 N 天 (MM/DD)`」。
  - **🟡 今天到期 (Due Today)**：截止日等於今日且未完成，顯示琥珀黃色徽章「`⚡ 今天到期`」。
  - **🔵 明天到期 (Due Tomorrow)**：截止日等於明天且未完成，顯示藍色徽章「`⏰ 明天到期`」。
  - **⚪ 未來到期 (Upcoming)**：截止日為未來日程，顯示中性柔和灰色徽章「`📅 MM/DD`」。
  - **✔️ 完成防呆 (Done)**：任務標記為完成 (`done`) 時，警報自動關閉，徽章轉換為灰色刪除線風格，避免視覺雜訊干擾。
- [x] **首頁工作區儀表板整合 (Dashboard Sync)**：
  - `js/index.js` 即時統計所有未完成且逾期之任務總數。
  - 首頁任務卡片在有逾期項目時，即時標記高亮紅字「`⚠️ 逾期 X 項`」。

---

## 待辦事項 / 後續優化方向

- [ ] **任務優先級標記 (Priority)**：
  - 支援「高 🔴 / 中 🟡 / 低 🟢」優先級切換，配合截止日期落實時間管理四象限。
- [ ] **多維度篩選與排序 (Filters & Sort)**：
  - 增加快速篩選膠囊鈕（如「全部」、「已逾期」、「今天到期」）。
  - 提供切換「自訂拖曳排序」或「依截止日由近到遠排序」。
- [ ] **行內快速新增 (Inline Quick Add)**：
  - 於各分類底部加入常駐輸入框，按下 Enter 即可連續建立任務，免除頻繁彈窗。
- [ ] **任務封存與批次清理 (Archive / Clear Completed)**：
  - 提供一鍵清理或封存單一分類/全部已完成任務，保持畫面精簡。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [tasks.html](file:///d:/Private/Runboard/tasks.html) | 任務清單視圖 | 任務清單介面結構、工具列、搜尋框與「隱藏已完成」按鈕 |
| [js/tasks.js](file:///d:/Private/Runboard/js/tasks.js) | 任務清單邏輯 | 核心 CRUD、狀態切換、`getDueDateBadge` 日期運算、分類/項目拖曳與渲染 |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 樣式庫 | 定義 `.task-due-badge` 系列色彩樣式、日曆反色及首頁逾期高亮樣式 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 工作區儀表板卡片介面 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 計算任務總數、進行中、已完成及未完成逾期任務數量並渲染 |
| [data.json](file:///d:/Private/Runboard/data.json) | 資料來源 | 集中儲存包含 `dueDate` 屬性之 tasks 陣列 |
