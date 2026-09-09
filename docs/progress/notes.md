# 功能進度紀錄：便條紙功能現況與優化藍圖 (Notes Optimization Roadmap)

- **紀錄時間**：2026-09-09
- **當前目標與背景**：
  便條紙（Notes）模組旨在提供本機離線工作時的輕量隨手筆記與暫存空間，常用於快速記錄本機目錄路徑、常用指令、測試環境帳密、API Token 及會議討論摘要。當前已具備基礎的多分類、自訂顏色、卡片自訂拉伸尺寸、拖曳排序與即時搜尋功能。本文件整理目前功能現況、使用痛點，並規劃分階段的後續優化方向，以作為後續疊代開發之依據。

---

## 已完成事項清單（功能現況）

- [x] **分類管理與折疊機制 (Category Management & Collapsing)**：
  - 支援動態新增、重命名與刪除分類。
  - 分類標題支援折疊/展開，折疊狀態持久化儲存於 `data.json` 中的 `collapsed`。
  - 支援分類標題整組拖曳排序。
- [x] **便條紙卡片基礎樣式與尺寸 (Card Layout & Resizing)**：
  - CSS Grid 響應式網格排列（`minmax(280px, 1fr)`）。
  - 便條卡片支援 `resize: both` 拖曳右下角調整寬高，於 `mouseup` 事件將 `width` 與 `height` 寫入本機資料持久化。
  - 支援透過原生顏色選擇器（`<input type="color">`）自訂卡片背景色彩。
- [x] **超連結自動解析 (Auto-link Detection)**：
  - 透過正則表達式自動偵測文字中的 URL（`http://` 或 `https://`），轉為可點擊的新分頁超連結。
- [x] **雙向拖曳排序 (Drag & Drop Sorting)**：
  - 支援卡片在同分類內部自訂順序調整。
  - 支援卡片跨分類拖曳搬移。
- [x] **關鍵字即時檢索 (Real-time Keyword Search)**：
  - 工具列提供搜尋輸入框，支援即時比對分類名稱與便條文字內容，動態過濾顯示卡片。
- [x] **首頁儀表板數據同步 (Dashboard Counter)**：
  - [index.html](file:///d:/Private/Runboard/index.html) 即時統計便條紙分類數與便條紙總數。
- [x] **雙擊行內直接編輯 (Inline Quick Editing)**：
  - 支援連點兩下（雙擊）便條紙卡片直接進入就地編輯模式（免開彈跳視窗）。
  - 進入編輯時自動關閉卡片拖曳與文字框事件冒泡，高度隨輸入動態自適配。
  - 支援快捷鍵操作：`Ctrl + Enter` 立即儲存、`Esc` 取消、點擊卡片外部（`blur`）自動儲存回 `data.json`。
  - 具備防呆機制：若意外清空文字則還原原文字，避免誤刪資料。
- [x] **智慧文字對比度與暗色便簽支援 (Smart Text Contrast)**：
  - 內建色彩明度演算法（YIQ 公式），深色底便簽自動套用純白字體與高反差連結，淺色便簽維持深色文字。

---

## 待辦事項 / 後續優化規劃 (Roadmap)

### 第一階段：高頻痛點解決與操作流暢度（優先實作）
- [ ] **一鍵複製全文 (Quick Copy Button)**：
  - 卡片右上角增設「📋」複製按鈕，點擊後免手動反白將全文複製至剪貼簿，並提供成功提示反饋。
- [ ] **便籤預設色票盤 (Preset Color Palette)**：
  - 彈出視窗提供 6~8 種柔和護眼便籤色票（便利貼黃、薄荷綠、晴空藍、淡粉、薰衣草紫、珊瑚橘、石墨深灰等），簡化原生選色流程。
- [ ] **重要便條釘選置頂 (Pin to Top)**：
  - 支援點擊「📌」將重要便條釘選於分類最前方，並帶有醒目識別標記。

### 第二階段：結構排版與檢索效率升級
- [ ] **選填「便條標題」欄位 (Optional Title)**：
  - 新增選填標題欄位，卡片上方以粗體呈現主題，讓長篇筆記更容易掃視。
- [ ] **重置自訂尺寸 (Reset Size Button)**：
  - 卡片操作區提供「↺」還原預設尺寸按鈕，清除自訂的 `width`/`height` 限制，恢復標準網格排版。
- [ ] **色彩標籤篩選列 (Color Filter)**：
  - 頂部工具列提供色彩圓點快速過濾鈕，支援僅檢視特定顏色分類之便條。
- [ ] **等寬字體與程式碼排版支援 (Monospace / Code Snippet Style)**：
  - 針對本機檔案路徑、API Key、指令與設定檔片段，提供等寬字體切換或優化排版。

### 第三階段：跨模組與儀表板深度整合
- [ ] **最後更新時間標記 (Updated Timestamp)**：
  - 記錄便條最後修改時間（`updatedAt`），於卡片右下角顯示「更新於 MM/DD」，掌握資訊時效性。
- [ ] **首頁儀表板置頂便條小工具 (Dashboard Pinned Notes)**：
  - 將釘選的便條同步顯示於首頁儀表板，作為每日開工最高頻的核心備忘看板。
- [ ] **一鍵轉存為待辦任務 (Convert Note to Task)**：
  - 便條紙若紀錄到代辦事項，可一鍵轉入 [tasks.html](file:///d:/Private/Runboard/tasks.html) 清單追蹤。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [notes.html](file:///d:/Private/Runboard/notes.html) | 便條紙視圖 | 便條紙介面結構、頂部工具列、搜尋框與清單容器 |
| [js/notes.js](file:///d:/Private/Runboard/js/notes.js) | 便條紙邏輯 | 核心 CRUD、Modal 彈窗、拖曳排序、尺寸監聽、搜尋過濾與渲染 |
| [css/style.css](file:///d:/Private/Runboard/css/style.css) | 樣式庫 | 定義 `.note-card`、網格排版、拖曳反饋、超連結與按鈕懸浮樣式 |
| [index.html](file:///d:/Private/Runboard/index.html) | 首頁視圖 | 工作區儀表板卡片介面 |
| [js/index.js](file:///d:/Private/Runboard/js/index.js) | 首頁邏輯 | 統計便條紙分類數與項目總數並渲染至首頁 |
| [data.json](file:///d:/Private/Runboard/Source/data.json) | 資料來源 | 集中儲存包含分類、便條內容、自訂顏色與寬高的 `notes` 陣列 |
