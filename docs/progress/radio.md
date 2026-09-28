# 功能進度紀錄：📻 即時電台播放與開源電台庫探索 (Live Radio Player & Discovery)

- **紀錄時間**：2026-09-28
- **當前目標與背景**：
  為 Runboard 工作區引入全新「📻 即時電台」工具，讓使用者在撰寫便條、規劃任務或日常辦公時，能直接在瀏覽器即時收聽台灣在地廣播（台中全國廣播、古典音樂台、中廣、ICRT、九八新聞台等）、國際新聞（BBC）以及工作/讀書專注背景音樂（Lofi、Jazz）。遵循 `GEMINI.md` 規範，採用純原生多頁架構、雙層 CSS/JS 模組化、離線優先、IndexedDB 跨頁持久化，並串接具備開放式 CORS 的全球開源公益電台資料庫 (Radio-Browser API)，提供完整的推薦電台下拉選單與線上探索體驗。

---

## 已完成事項清單

- [x] **實體多頁與規範遵從 (`GEMINI.md`)**：
  - 建立專屬實體視圖 [radio.html](file:///c:/JS_Source/WebApp/Runboard_HTML/radio.html)，採用原生 `<a href="...">` 頁面跳轉。
  - 引入全域基底樣式 `css/style.css` 與專屬樣式 [css/radio.css](file:///c:/JS_Source/WebApp/Runboard_HTML/css/radio.css)。
  - 依序載入核心組件 `js/storage.js`、`js/nav.js`、`js/modal.js` 及專屬邏輯 [js/radio.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/radio.js)（IIFE 模組化封裝）。
  - 於 [js/nav.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/nav.js) 全域選單中註冊 `{ title: '📻 即時電台', url: 'radio.html' }`，支援拖曳排序。
  - 於 [index.html](file:///c:/JS_Source/WebApp/Runboard_HTML/index.html) 與 [js/index.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/index.js) 首頁儀表板整合電台統計卡片與快速傳送門。
- [x] **資料核心擴充與持久化 (`data.json` & `js/storage.js`)**：
  - 在 `Storage` 模組中擴充 `data.radios` 讀取與寫入支援。
  - 於 `Source/data.json` 配置 6 組精選熱門電台（AsiaFM 亞洲電台、亞太電台、1766 私房音樂、1766 百家知識、Jazz Cafe 放鬆爵士、Lofi 專注音樂）。
  - 同步更新範本檔 `Source/temp_data.json` 加入 `"radios": []` 結構。
- [x] **核心播放器控制面板 (Now Playing Deck)**：
  - 呈現當前播放電台名稱、地區、分類、說明與串流品質資訊。
  - 內建 **5 頻段動態聲波動畫 (Equalizer)**，在音訊播放時會隨律動自動彈跳，提供絕佳視覺回饋。
  - 控制元件：播放/暫停按鈕、停止按鈕、音量調節滑桿（0% ~ 100%）、一鍵靜音切換。
  - 即時連線狀態燈號（待機中 ⚪、連線緩衝中 🟡、播放中 🟢、串流離線異常 🔴）。
- [x] **⭐ 我的收藏電台管理**：
  - 支援依分類即時篩選晶片（全部、流行音樂、綜合娛樂、放鬆輕音樂、專注讀書...）。
  - 搜尋框支援即時關鍵字模糊過濾（名稱、地區、標籤、說明）。
  - 支援點擊「＋ 新增自訂電台」調用共用 `Modal.open` 彈窗，輸入任意自訂串流網址並自動儲存回 `data.json`。
  - 支援電台資訊編輯 (`Modal.open`) 與刪除確認。
  - 卡片播放狀態同步高亮（Now Playing 光暈與邊框）。
- [x] **🌐 線上探索電台庫 (Radio-Browser API)**：
  - 串接全球最大開放式電台庫 API（具備 CORS 支援，跨來源 fetch 不受阻擋）。
  - 支援多伺服器節點備援機制（`de1`、`at1`、`nl1`）。
  - 支援關鍵字搜尋、即時試聽 (Preview) 以及一鍵「➕ 加入收藏」，自動寫入本機 `data.json`。
- [x] **👇 推薦電台下拉選單與 `<datalist>` 自動提示**：
  - 解決使用者初次使用不知道有哪些電台可選的問題。
  - 新增分類下拉選單 (`<select id="popular-station-select">`)，彙整台中在地電台（全國廣播、古典音樂台 FM 97.7、大樹下電台）、台灣聯播網（中廣流行網/新聞網、九八新聞台、ICRT、Hit FM、RTI 臺灣之音、教育廣播）、音樂專案與國際頻道。
  - 搭配 HTML5 `<datalist>`，點擊文字搜尋框時自動彈出電台候選清單，輸入文字時即時過濾配對。

---

## 核心檔案對照表

| 檔案路徑 | 模組類型 | 職責與用途說明 |
| :--- | :--- | :--- |
| [radio.html](file:///c:/JS_Source/WebApp/Runboard_HTML/radio.html) | 頁面視圖 | 即時電台獨立實體頁面，包含控制台、分頁切換、搜尋與卡片清單 |
| [css/radio.css](file:///c:/JS_Source/WebApp/Runboard_HTML/css/radio.css) | 專屬樣式 | 雙層模組化之電台專屬 CSS，管理控制台、聲波動畫、卡片與下拉選單樣式 |
| [js/radio.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/radio.js) | 專屬邏輯 | HTML5 Audio 音訊控制、分類篩選、Modal 新增/編輯、開源 API 連線與推薦選單聯動 |
| [js/storage.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/storage.js) | 核心資料層 | 增加 `data.radios` 欄位支援與跨頁面自動持久化 |
| [js/nav.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/nav.js) | 導覽組件 | 註冊「📻 即時電台」選單項目 |
| [index.html](file:///c:/JS_Source/WebApp/Runboard_HTML/index.html) | 首頁視圖 | 工作區儀表板新增即時電台卡片與傳送門 |
| [js/index.js](file:///c:/JS_Source/WebApp/Runboard_HTML/js/index.js) | 首頁邏輯 | 動態統計已收藏電台數量並更新儀表板數值 |
| [Source/temp_data.json](file:///c:/JS_Source/WebApp/Runboard_HTML/Source/temp_data.json) | 資料範本 | 補充 `radios: []` 預設空結構 |

---

## 待辦事項 / 後續優化規劃

- [ ] **迷你懸浮小播放器 (Mini PiP Player)**：
  - 支援以子視窗小視窗 (`window.open`) 或懸浮模式開啟，方便切換至其他工作頁面時持續背景播放。
- [ ] **定時關閉 / 睡眠定時器 (Sleep Timer)**：
  - 支援設定 15 / 30 / 60 分鐘後自動漸漸調低音量並暫停播放。
- [ ] **HLS (`.m3u8`) 串流擴充支援**：
  - 針對部分電視轉播或特殊格式電台，於 `lib/` 下載引入輕量 `hls.light.min.js` 實現無縫相容。
