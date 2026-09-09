/**
 * Runboard - 便條紙 (Notes) 專屬邏輯
 */
const NotesApp = (function () {
    let draggedItemInfo = null;
    let draggedCategoryInfo = null;

    function getNotes() {
        const data = Storage.getData();
        if (!data.notes) data.notes = [];
        return data.notes;
    }

    function render() {
        const listContainer = document.getElementById('notes-list');
        if (!listContainer) return;

        const categories = getNotes();
        let html = '';

        categories.forEach((cat, catIdx) => {
            const isCollapsed = cat.collapsed ? 'collapsed' : '';
            html += `
            <div class="category" ondragover="NotesApp.handleDragOver(event)" ondragleave="NotesApp.handleDragLeave(event)" ondrop="NotesApp.handleDrop(event, ${catIdx})">
                <div class="category-header">
                    <div class="category-title-area" draggable="true" ondragstart="NotesApp.handleCategoryDragStart(event, ${catIdx})" ondragend="NotesApp.handleCategoryDragEnd(event)" onclick="NotesApp.toggleCategory(${catIdx})">
                        <span class="toggle-icon ${isCollapsed}">▼</span>
                        <div class="category-name">${cat.category}</div>
                    </div>
                    <div>
                        <button class="btn btn-small" onclick="NotesApp.openAddNote(${catIdx})">＋新增便條紙</button>
                        <button class="btn btn-small" onclick="NotesApp.openEditCategory(${catIdx})">✏️</button>
                        <button class="btn btn-small" style="color:var(--danger-color); border-color:transparent;" onclick="NotesApp.deleteCategory(${catIdx})">🗑️</button>
                    </div>
                </div>
                <div class="list-container ${isCollapsed}">
            `;

            if (cat.items) {
                cat.items.forEach((item, itemIdx) => {
                    const bgColor = item.color || '#fde047';
                    const w = item.width ? `width: ${item.width};` : '';
                    const h = item.height ? `height: ${item.height};` : '';

                    html += `
                    <div class="item-card note-card" style="background-color: ${bgColor}; ${w} ${h}" draggable="true" ondragstart="NotesApp.handleDragStart(event, ${catIdx}, ${itemIdx})" ondragend="NotesApp.handleDragEnd(event)" data-cat-idx="${catIdx}" data-item-idx="${itemIdx}">
                        <button class="edit-btn" onclick="NotesApp.openEditNote(${catIdx}, ${itemIdx})">✏️</button>
                        <button class="delete-btn" onclick="NotesApp.deleteNote(${catIdx}, ${itemIdx})">✕</button>
                        <div class="item-title">${item.content || ''}</div>
                    </div>
                    `;
                });
            }

            html += `</div></div>`;
        });

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
    }

    function handleDragEnd(event) {
        event.target.classList.remove('dragging');
        draggedItemInfo = null;
        document.querySelectorAll('.category').forEach(el => el.classList.remove('drag-over'));
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

    async function handleDrop(event, targetCatIdx) {
        event.preventDefault();
        event.stopPropagation();
        const catEl = event.currentTarget;
        catEl.classList.remove('drag-over');

        const categories = getNotes();

        if (draggedItemInfo) {
            const sourceCatIdx = draggedItemInfo.catIdx;
            const sourceItemIdx = draggedItemInfo.itemIdx;

            if (sourceCatIdx === targetCatIdx) return;

            const sourceList = categories[sourceCatIdx].items;
            const targetList = categories[targetCatIdx].items;

            const [movedItem] = sourceList.splice(sourceItemIdx, 1);
            targetList.push(movedItem);

            await Storage.save();
            render();
        } else if (draggedCategoryInfo) {
            const sourceCatIdx = draggedCategoryInfo.catIdx;
            if (sourceCatIdx === targetCatIdx) return;

            const [movedCat] = categories.splice(sourceCatIdx, 1);
            categories.splice(targetCatIdx, 0, movedCat);

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
            html: `<div class="form-group"><label>分類名稱</label><input type="text" id="ipt-cat-name" value="${cat.category}"></div>`,
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
                    <textarea id="ipt-content" rows="6" style="width:100%; background:var(--bg-color); border:1px solid var(--border-color); color:white; padding:10px; border-radius:6px; outline:none; resize:vertical;">${item.content || ''}</textarea>
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
        toggleCategory,
        handleDragStart,
        handleCategoryDragStart,
        handleCategoryDragEnd,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        openAddCategory,
        openEditCategory,
        deleteCategory,
        openAddNote,
        openEditNote,
        deleteNote
    };
})();

window.NotesApp = NotesApp;
