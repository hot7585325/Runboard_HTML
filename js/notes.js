/**
 * Runboard - 便條紙 (Notes) 專屬邏輯
 */
const NotesApp = (function () {
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;
    let searchKeyword = '';

    function getNotes() {
        const data = Storage.getData();
        if (!data.notes) data.notes = [];
        return data.notes;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatNoteContent(content) {
        if (!content) return '';
        const escaped = escapeHtml(content);
        const urlRegex = /(https?:\/\/[^\s<>"']+)/gi;
        return escaped.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="note-link" onclick="event.stopPropagation()">${url}</a>`;
        });
    }

    function isDarkColor(hexColor) {
        if (!hexColor) return false;
        let c = hexColor.replace('#', '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        if (c.length !== 6) return false;
        const r = parseInt(c.substring(0, 2), 16) || 0;
        const g = parseInt(c.substring(2, 4), 16) || 0;
        const b = parseInt(c.substring(4, 6), 16) || 0;
        const yiq = (r * 299 + g * 587 + b * 114) / 1000;
        return yiq < 130;
    }

    function handleSearch(keyword) {
        searchKeyword = (keyword || '').trim().toLowerCase();
        render();
    }

    function render() {
        const listContainer = document.getElementById('notes-list');
        if (!listContainer) return;

        const categories = getNotes();
        let html = '';
        let totalMatched = 0;

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            const catNameMatches = searchKeyword && cat.category && cat.category.toLowerCase().includes(searchKeyword);

            // 篩選欲顯示的便條紙與其原始索引
            const itemsToRender = [];
            if (cat.items) {
                cat.items.forEach((item, itemIdx) => {
                    if (!searchKeyword) {
                        itemsToRender.push({ item, itemIdx });
                    } else {
                        const contentMatch = item.content && item.content.toLowerCase().includes(searchKeyword);
                        if (contentMatch || catNameMatches) {
                            itemsToRender.push({ item, itemIdx });
                        }
                    }
                });
            }

            // 搜尋時若無符合項目且分類名稱不符合，則跳過此分類
            if (searchKeyword && itemsToRender.length === 0 && !catNameMatches) {
                return;
            }

            totalMatched += itemsToRender.length;

            html += `
            <div class="category" ondragover="NotesApp.handleDragOver(event)" ondragleave="NotesApp.handleDragLeave(event)" ondrop="NotesApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="NotesApp.handleCategoryDragStart(event, ${catIdx})" ondragend="NotesApp.handleCategoryDragEnd(event)" onclick="NotesApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">${escapeHtml(cat.category)}</div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="NotesApp.openAddNote(${catIdx})">＋新增便條紙</button>
                        <button class="btn btn-small" onclick="NotesApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="NotesApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="list-container ${isCollapsed}">
            `;

            itemsToRender.forEach(({ item, itemIdx }) => {
                const bgColor = item.color || '#fde047';
                const w = item.width ? `width: ${item.width};` : '';
                const h = item.height ? `height: ${item.height};` : '';
                const darkClass = isDarkColor(bgColor) ? 'dark-theme' : '';

                html += `
                <div class="item-card note-card ${darkClass}" style="background-color: ${bgColor}; ${w} ${h}" draggable="true"
                    ondragstart="NotesApp.handleDragStart(event, ${catIdx}, ${itemIdx})"
                    ondragend="NotesApp.handleDragEnd(event)"
                    ondragover="NotesApp.handleItemDragOver(event)"
                    ondragleave="NotesApp.handleItemDragLeave(event)"
                    ondrop="NotesApp.handleItemDrop(event, ${catIdx}, ${itemIdx})"
                    ondblclick="NotesApp.enableInlineEdit(event, ${catIdx}, ${itemIdx})"
                    data-cat-idx="${catIdx}" data-item-idx="${itemIdx}"
                    title="連點兩下直接編輯內容">
                    <button class="edit-btn" onclick="NotesApp.openEditNote(${catIdx}, ${itemIdx})" title="完整編輯視窗">✏️</button>
                    <button class="delete-btn" onclick="NotesApp.deleteNote(${catIdx}, ${itemIdx})" title="刪除便條">✕</button>
                    <div class="item-title">${formatNoteContent(item.content || '')}</div>
                </div>
                `;
            });

            html += `</div></div>`;
        });

        if (searchKeyword && totalMatched === 0 && categories.length > 0) {
            html = `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">沒有找到符合「${escapeHtml(searchKeyword)}」的便條紙</div>`;
        }

        listContainer.innerHTML = html;
    }

    // 收合分類
    async function toggleCategory(catIdx) {
        const cat = getNotes()[catIdx];
        if (!cat) return;
        cat.collapsed = !cat.collapsed;
        await Storage.save();
        render();
    }

    // 拖曳處理
    function handleDragStart(event, catIdx, itemIdx) {
        event.stopPropagation();
        draggedItemInfo = { catIdx, itemIdx };
        draggedCategoryInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-note');
        setTimeout(() => {
            event.target.classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragStart(event, catIdx) {
        event.stopPropagation();
        draggedCategoryInfo = { catIdx };
        draggedItemInfo = null;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', 'runboard-category');
        setTimeout(() => {
            event.target.closest('.category').classList.add('dragging');
        }, 0);
    }

    function handleCategoryDragEnd(event) {
        event.target.closest('.category')?.classList.remove('dragging');
        draggedCategoryInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedItemInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(event) {
        const catEl = event.currentTarget;
        if (!catEl.contains(event.relatedTarget)) {
            catEl.classList.remove('drag-over');
        }
    }

    function handleItemDragOver(event) {
        if (!draggedItemInfo) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        event.currentTarget.classList.add('drag-target-over');
    }

    function handleItemDragLeave(event) {
        const itemEl = event.currentTarget;
        if (!itemEl.contains(event.relatedTarget)) {
            itemEl.classList.remove('drag-target-over');
        }
    }

    async function handleItemDrop(event, targetCatIdx, targetItemIdx) {
        event.preventDefault();
        event.stopPropagation();
        document.querySelectorAll('.drag-target-over').forEach(el => el.classList.remove('drag-target-over'));
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));

        if (!draggedItemInfo) return;

        const sourceCatIdx = draggedItemInfo.catIdx;
        const sourceItemIdx = draggedItemInfo.itemIdx;

        const categories = getNotes();
        const sourceList = categories[sourceCatIdx]?.items;
        const targetList = categories[targetCatIdx]?.items;
        if (!sourceList || !targetList) return;

        if (sourceCatIdx === targetCatIdx) {
            if (sourceItemIdx === targetItemIdx) return;
            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.splice(targetItemIdx, 0, movedItem);
        } else {
            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.splice(targetItemIdx, 0, movedItem);
        }

        draggedItemInfo = null;
        await Storage.save();
        render();
    }

    async function handleDrop(event, targetCatIdx) {
        event.preventDefault();
        event.stopPropagation();
        const catEl = event.currentTarget;
        catEl.classList.remove('drag-over');

        const categories = getNotes();

        if (draggedItemInfo) {
            const sourceCatIdx = draggedItemInfo.catIdx;
            const sourceItemIdx = draggedItemInfo.itemIdx;

            const sourceList = categories[sourceCatIdx]?.items;
            const targetList = categories[targetCatIdx]?.items;
            if (!sourceList || !targetList) return;

            if (sourceCatIdx === targetCatIdx) {
                if (sourceItemIdx !== sourceList.length - 1) {
                    const [movedItem] = sourceList.splice(sourceItemIdx, 1);
                    targetList.push(movedItem);
                    await Storage.save();
                    render();
                }
            } else {
                const [movedItem] = sourceList.splice(sourceItemIdx, 1);
                targetList.push(movedItem);
                await Storage.save();
                render();
            }
            draggedItemInfo = null;
        } else if (draggedCategoryInfo) {
            const sourceCatIdx = draggedCategoryInfo.catIdx;
            if (sourceCatIdx === targetCatIdx) return;

            const [movedCat] = categories.splice(sourceCatIdx, 1);
            categories.splice(targetCatIdx, 0, movedCat);

            draggedCategoryInfo = null;
            await Storage.save();
            render();
        }
    }

    // Modal 與 CRUD
    function openAddCategory() {
        Modal.open({
            title: '新增便條紙分類',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" placeholder="例如: 隨手記"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                getNotes().push({ category: val, items: [], collapsed: false });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditCategory(catIdx) {
        const cat = getNotes()[catIdx];
        Modal.open({
            title: '編輯分類名稱',
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" value="${escapeHtml(cat.category)}"></div>`,
            onConfirm: async () => {
                const val = document.getElementById('ipt-cat-name').value.trim();
                if (!val) {
                    alert('請輸入分類名稱');
                    return false;
                }
                cat.category = val;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteCategory(catIdx) {
        if (!confirm('確定要刪除此分類及所有便條紙嗎？')) return;
        getNotes().splice(catIdx, 1);
        await Storage.save();
        render();
    }

    function openAddNote(catIdx) {
        Modal.open({
            title: '新增便條紙',
            html: `
                <div class="form-group">
                    <label>便條紙顏色</label>
                    <input type="color" id="ipt-color" value="#fde047" style="height:35px; border-radius:4px; padding:2px; cursor:pointer;">
                </div>
                <div class="form-group">
                    <label>筆記內容</label>
                    <textarea id="ipt-content" rows="6" placeholder="輸入內容..." style="width:100%; background:var(--bg-color); border:1px solid var(--border-color); color:white; padding:10px; border-radius:6px; outline:none; resize:vertical;"></textarea>
                </div>
            `,
            onConfirm: async () => {
                const content = document.getElementById('ipt-content').value.trim();
                const color = document.getElementById('ipt-color').value;
                if (!content) {
                    alert('內容為必填');
                    return false;
                }
                const cat = getNotes()[catIdx];
                if (!cat.items) cat.items = [];
                cat.items.push({ content, color });
                await Storage.save();
                render();
                return true;
            }
        });
    }

    function openEditNote(catIdx, itemIdx) {
        const item = getNotes()[catIdx].items[itemIdx];
        const bgColor = item.color || '#fde047';

        Modal.open({
            title: '編輯便條紙',
            html: `
                <div class="form-group">
                    <label>便條紙顏色</label>
                    <input type="color" id="ipt-color" value="${bgColor}" style="height:35px; border-radius:4px; padding:2px; cursor:pointer;">
                </div>
                <div class="form-group">
                    <label>筆記內容</label>
                    <textarea id="ipt-content" rows="6" style="width:100%; background:var(--bg-color); border:1px solid var(--border-color); color:white; padding:10px; border-radius:6px; outline:none; resize:vertical;">${escapeHtml(item.content || '')}</textarea>
                </div>
            `,
            onConfirm: async () => {
                const content = document.getElementById('ipt-content').value.trim();
                const color = document.getElementById('ipt-color').value;
                if (!content) {
                    alert('內容為必填');
                    return false;
                }
                item.content = content;
                item.color = color;
                await Storage.save();
                render();
                return true;
            }
        });
    }

    async function deleteNote(catIdx, itemIdx) {
        if (!confirm('確定要刪除此便條紙嗎？')) return;
        getNotes()[catIdx].items.splice(itemIdx, 1);
        await Storage.save();
        render();
    }

    // 雙擊行內直接編輯 (Inline Editing)
    function enableInlineEdit(event, catIdx, itemIdx) {
        // 避開超連結與按鈕點擊
        if (event.target.closest('a') || event.target.closest('button')) return;

        const card = event.currentTarget;
        if (card.querySelector('.inline-note-editor')) return; // 避免重複開啟

        const note = getNotes()[catIdx]?.items?.[itemIdx];
        if (!note) return;

        const originalContent = note.content || '';
        const titleEl = card.querySelector('.item-title');
        if (!titleEl) return;

        // 進入編輯時暫時關閉卡片拖曳，避免選取文字觸發拖曳
        card.setAttribute('draggable', 'false');

        titleEl.innerHTML = `
            <textarea class="inline-note-editor" placeholder="輸入便條紙內容...">${escapeHtml(originalContent)}</textarea>
            <div class="inline-editor-tips">Ctrl+Enter 儲存 · Esc 取消 · 點擊外部自動儲存</div>
        `;

        const textarea = titleEl.querySelector('.inline-note-editor');
        if (!textarea) return;

        // 聚焦並將游標移至文字末端
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        // 動態根據內容適配高度
        const autoAdjustHeight = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.max(100, textarea.scrollHeight) + 'px';
        };
        autoAdjustHeight();
        textarea.addEventListener('input', autoAdjustHeight);

        // 阻擋輸入框內事件冒泡至外層卡片
        textarea.addEventListener('mousedown', (e) => e.stopPropagation());
        textarea.addEventListener('mouseup', (e) => e.stopPropagation());
        textarea.addEventListener('click', (e) => e.stopPropagation());
        textarea.addEventListener('dblclick', (e) => e.stopPropagation());

        let isExited = false;

        async function saveAndClose() {
            if (isExited) return;
            isExited = true;
            const newContent = textarea.value.trim();
            if (!newContent) {
                // 若內容全被清空，還原原有內容，避免誤刪
                note.content = originalContent;
            } else if (newContent !== originalContent) {
                note.content = newContent;
                await Storage.save();
            }
            render();
        }

        function cancelAndClose() {
            if (isExited) return;
            isExited = true;
            render();
        }

        // 鍵盤操作監聽
        textarea.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelAndClose();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveAndClose();
            }
        });

        // 失焦自動儲存
        textarea.addEventListener('blur', () => {
            setTimeout(() => {
                saveAndClose();
            }, 120);
        });
    }

    // 監聽拖拉卡片大小改變
    document.addEventListener('mouseup', async (e) => {
        const card = e.target.closest('.note-card');
        if (card) {
            const catIdx = card.getAttribute('data-cat-idx');
            const itemIdx = card.getAttribute('data-item-idx');
            const notes = getNotes();
            if (catIdx !== null && itemIdx !== null && notes[catIdx] && notes[catIdx].items[itemIdx]) {
                const item = notes[catIdx].items[itemIdx];
                const newW = card.style.width;
                const newH = card.style.height;
                let changed = false;
                if (newW && item.width !== newW) { item.width = newW; changed = true; }
                if (newH && item.height !== newH) { item.height = newH; changed = true; }
                if (changed) {
                    await Storage.save();
                }
            }
        }
    });

    // 初始化載入
    document.addEventListener('DOMContentLoaded', () => {
        Storage.init(() => {
            render();
        });
    });

    return {
        render,
        handleSearch,
        toggleCategory,
        handleDragStart,
        handleCategoryDragStart,
        handleCategoryDragEnd,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleItemDragOver,
        handleItemDragLeave,
        handleItemDrop,
        handleDrop,
        openAddCategory,
        openEditCategory,
        deleteCategory,
        openAddNote,
        openEditNote,
        deleteNote,
        enableInlineEdit
    };
})();

window.NotesApp = NotesApp;
