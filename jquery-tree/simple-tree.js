/**
 * SimpleTree - 支持自定义树类型
 */
(function($) {
    'use strict';

    const defaults = {
        data: [],
        defaultCollapsed: true,
        treeType: 'right',        // 树类型：'left' 或 'right'，left 树只能复制，right 树可拖拽重排
        icons: {
            folder: '📁',
            folderOpen: '📂',
            file: '📄',
            default: '•'
        },
        onCopy: null,
        onMove: null,
        onDragStart: null,
        onDragEnd: null,
        onAddNode: null,
        onDeleteNode: null,
        emptyText: '暂无数据，从左侧拖拽节点到这里',
        allowDropToEmpty: true,
        duplicateCheck: true
    };

    let dragState = {
        sourceNode: null,
        sourceTree: null,
        sourceTreeType: null,
        sourceId: null,
        clone: null,
        targetNode: null,
        targetPosition: null,
        isDragging: false,
        isValidDrop: false
    };

    let selectedNodeId = null;
    let selectedNodeTree = null;
    let selectedNodeTreeType = null;

    // ========== 工具函数 ==========
    
    function findNode(tree, id) {
        if (!tree) return null;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == id) return { node, parent: null, index: i, children: tree };
            if (node.children) {
                const found = findNode(node.children, id);
                if (found) {
                    found.parent = node;
                    return found;
                }
            }
        }
        return null;
    }

    function isNodeNameExists(tree, name, excludeId = null) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.text === name && node.id !== excludeId) {
                return true;
            }
            if (node.children && isNodeNameExists(node.children, name, excludeId)) {
                return true;
            }
        }
        return false;
    }

    function isValidDropTarget(sourceNode, sourceType, targetType, targetNodeId, targetTreeData) {
        // 左 -> 右：复制，检查重复名称
        if (sourceType === 'left' && targetType === 'right') {
            return !isNodeNameExists(targetTreeData, sourceNode.text);
        }
        // 右 -> 右：移动，不能移动到自身或后代
        else if (sourceType === 'right' && targetType === 'right') {
            if (sourceNode.id == targetNodeId) return false;
            if (isDescendantOfNode(sourceNode, targetNodeId)) return false;
            return true;
        }
        // 左 -> 左：不允许
        else if (sourceType === 'left' && targetType === 'left') {
            return false;
        }
        return false;
    }

    function removeNode(tree, id) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            if (tree[i].id == id) {
                tree.splice(i, 1);
                return true;
            }
            if (tree[i].children && removeNode(tree[i].children, id)) {
                return true;
            }
        }
        return false;
    }

    function insertNode(tree, targetId, newNode, position) {
        if (!tree) return false;
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == targetId) {
                if (position === 'inside') {
                    if (!node.children) node.children = [];
                    node.children.push(newNode);
                } else if (position === 'before') {
                    tree.splice(i, 0, newNode);
                } else if (position === 'after') {
                    tree.splice(i + 1, 0, newNode);
                }
                return true;
            }
            if (node.children && insertNode(node.children, targetId, newNode, position)) {
                return true;
            }
        }
        return false;
    }

    function cloneNode(node) {
        return JSON.parse(JSON.stringify(node));
    }

    function isDescendantOfNode(parentNode, childId) {
        if (!parentNode || !parentNode.children) return false;
        for (let child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendantOfNode(child, childId)) return true;
        }
        return false;
    }

    // ========== 折叠状态 ==========
    
    function collectCollapsedState($container) {
        const state = {};
        if (!$container) return state;
        $container.find('li').each(function() {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;
            
            const $children = $li.children('.node-children');
            if ($children.length && $children.is(':visible') === false) {
                state[nodeId] = true;
            } else if ($children.length) {
                state[nodeId] = false;
            }
        });
        return state;
    }

    function restoreCollapsedState($container, state) {
        if (!$container) return;
        $container.find('li').each(function() {
            const $li = $(this);
            const $treeNode = $li.find('.tree-node').first();
            const nodeId = $treeNode.data('id');
            if (!nodeId) return;
            
            const $children = $li.children('.node-children');
            const $icon = $li.find('.toggle-icon');
            
            if ($children.length && state.hasOwnProperty(nodeId)) {
                if (state[nodeId] === true) {
                    $children.hide();
                    $icon.text('▶');
                } else {
                    $children.show();
                    $icon.text('▼');
                }
            }
        });
    }

    function getDropPosition(e, targetEl) {
        if (!targetEl) return 'root';
        const rect = targetEl.getBoundingClientRect();
        const y = e.clientY;
        const height = rect.height;
        const ratio = (y - rect.top) / height;
        if (ratio < 0.33) return 'before';
        if (ratio > 0.66) return 'after';
        return 'inside';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function generateId() {
        return 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
    }

    function getNodeIcon(node, isCollapsed, icons) {
        const hasChildren = node.children && node.children.length > 0;
        if (hasChildren) {
            if (!isCollapsed && icons.folderOpen) {
                return icons.folderOpen;
            }
            return icons.folder;
        }
        return node.icon || icons.file || icons.default || '•';
    }

    // ========== 搜索功能 ==========
    
    let currentSearchKeyword = '';
    
    function clearHighlights($container) {
        $container.find('.tree-node').removeClass('highlight');
    }
    
    function performSearch($container, keyword, options) {
        clearHighlights($container);
        
        if (!keyword || keyword.trim() === '') {
            currentSearchKeyword = '';
            return false;
        }
        
        const lowerKeyword = keyword.toLowerCase();
        let hasMatch = false;
        const matchedIds = [];
        
        function collectMatches(nodes, parentPath) {
            if (!nodes) return;
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                if (node.text && node.text.toLowerCase().includes(lowerKeyword)) {
                    matchedIds.push(node.id);
                    hasMatch = true;
                    for (let j = 0; j < parentPath.length; j++) {
                        const pathNode = parentPath[j];
                        if (pathNode && pathNode.id) {
                            matchedIds.push(pathNode.id);
                        }
                    }
                }
                if (node.children) {
                    collectMatches(node.children, [...parentPath, node]);
                }
            }
        }
        
        const treeData = $container.data('treeData');
        if (treeData) {
            collectMatches(treeData, []);
        }
        
        matchedIds.forEach(id => {
            const $li = $container.find(`li[data-id="${id}"]`);
            if ($li.length) {
                const $children = $li.children('.node-children');
                const $icon = $li.find('.toggle-icon');
                if ($children.length && $children.is(':visible') === false) {
                    $children.show();
                    $icon.text('▼');
                }
            }
        });
        
        $container.find('.tree-node').each(function() {
            const $node = $(this);
            const nodeId = $node.data('id');
            const nodeInfo = findNode(treeData, nodeId);
            if (nodeInfo && nodeInfo.node.text && nodeInfo.node.text.toLowerCase().includes(lowerKeyword)) {
                $node.addClass('highlight');
            }
        });
        
        currentSearchKeyword = keyword;
        return hasMatch;
    }
    
    // ========== 添加节点功能 ==========
    
    function showAddNodeDialog($container, options, targetNodeId = null) {
        let defaultName = '新节点';
        let positionDesc = targetNodeId ? '子节点' : '根节点';
        
        const newNodeName = prompt(`请输入节点名称（将添加到${positionDesc}）：`, defaultName);
        if (!newNodeName || newNodeName.trim() === '') return;
        
        const treeData = $container.data('treeData');
        if (!treeData) return;
        
        if (options.duplicateCheck) {
            const exists = isNodeNameExists(treeData, newNodeName.trim());
            if (exists) {
                alert('节点 "' + newNodeName.trim() + '" 已存在，不能重复添加');
                return;
            }
        }
        
        const newNode = {
            id: generateId(),
            text: newNodeName.trim(),
            children: []
        };
        
        let success = false;
        
        if (targetNodeId) {
            success = insertNode(treeData, targetNodeId, newNode, 'inside');
            if (success) {
                const $parentLi = $container.find(`li[data-id="${targetNodeId}"]`);
                if ($parentLi.length) {
                    const $children = $parentLi.children('.node-children');
                    const $icon = $parentLi.find('.toggle-icon');
                    if ($children.length && $children.is(':visible') === false) {
                        $children.show();
                        $icon.text('▼');
                    }
                }
            }
        } else {
            treeData.push(newNode);
            success = true;
        }
        
        if (success) {
            $container.data('treeData', treeData);
            renderTree($container, treeData, options, true);
            
            if (options.onAddNode) {
                options.onAddNode(newNode, targetNodeId || null);
            }
        }
    }
    
    // ========== 删除节点功能 ==========
    
    function deleteSelectedNode($container, options) {
        if (!selectedNodeId || selectedNodeTree !== $container[0]) {
            alert('请先点击选中要删除的节点');
            return;
        }
        
        const treeData = $container.data('treeData');
        if (!treeData) {
            alert('无法获取树数据');
            return;
        }
        
        const nodeInfo = findNode(treeData, selectedNodeId);
        if (!nodeInfo) {
            alert('找不到选中的节点');
            return;
        }
        
        if (confirm(`确定要删除节点 "${nodeInfo.node.text}" 吗？${nodeInfo.node.children && nodeInfo.node.children.length > 0 ? '（子节点也会被删除）' : ''}`)) {
            removeNode(treeData, selectedNodeId);
            $container.data('treeData', treeData);
            
            selectedNodeId = null;
            selectedNodeTree = null;
            selectedNodeTreeType = null;
            
            renderTree($container, treeData, options, true);
            
            if (options.onDeleteNode) {
                options.onDeleteNode(nodeInfo.node);
            }
            
            updateDeleteButtonState($container);
        }
    }
    
    function updateDeleteButtonState($container) {
        const $deleteBtn = $container.parent().find('.delete-btn');
        if ($deleteBtn.length) {
            const hasSelection = (selectedNodeTree === $container[0] && selectedNodeId);
            if (hasSelection) {
                $deleteBtn.removeClass('disabled').prop('disabled', false);
            } else {
                $deleteBtn.addClass('disabled').prop('disabled', true);
            }
        }
    }
    
    // ========== 渲染函数 ==========
    
    function renderTree($container, data, options, preserveState = true) {
        const icons = options.icons;
        const isEmpty = !data || data.length === 0;
        
        let collapsedState = {};
        if (preserveState && !isEmpty) {
            collapsedState = collectCollapsedState($container);
        }

        function buildHtml(nodes) {
            let html = '<ul>';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const hasChildren = node.children && node.children.length > 0;
                let isCollapsed = options.defaultCollapsed;
                if (preserveState && collapsedState.hasOwnProperty(node.id)) {
                    isCollapsed = collapsedState[node.id];
                }
                const collapsedStyle = (hasChildren && isCollapsed) ? 'display: none;' : '';
                
                const icon = getNodeIcon(node, isCollapsed, icons);
                const nodeTypeClass = hasChildren ? 'folder' : 'leaf';
                const isSelected = (selectedNodeId === node.id && selectedNodeTree === $container[0]);
                const selectedClass = isSelected ? 'selected' : '';
                
                html += `<li data-id="${node.id}">`;
                html += `<div class="tree-node ${nodeTypeClass} ${selectedClass}" data-id="${node.id}">`;
                html += `<span class="toggle-icon ${hasChildren ? '' : 'empty'}" data-id="${node.id}">${hasChildren ? (isCollapsed ? '▶' : '▼') : ''}</span>`;
                html += `<span class="node-icon">${escapeHtml(icon)}</span>`;
                html += `<span class="node-content">${escapeHtml(node.text)}</span>`;
                html += `</div>`;
                if (hasChildren) {
                    html += `<div class="node-children" data-parent="${node.id}" style="${collapsedStyle}">${buildHtml(node.children)}</div>`;
                }
                html += `</li>`;
            }
            html += '</ul>';
            return html;
        }
        
        if (isEmpty && options.allowDropToEmpty && options.treeType === 'right') {
            $container.html(`
                <div class="simple-tree-empty" data-empty-area="true">
                    <div class="empty-placeholder">${escapeHtml(options.emptyText)}</div>
                </div>
            `);
            bindEmptyTreeEvents($container, options);
        } else if (isEmpty) {
            $container.html('<div class="tree-node">无数据</div>');
        } else {
            $container.html(buildHtml(data));
            if (preserveState && Object.keys(collapsedState).length > 0) {
                restoreCollapsedState($container, collapsedState);
            }
            bindEvents($container, options);
        }
        
        if (currentSearchKeyword) {
            performSearch($container, currentSearchKeyword, options);
        }
        
        updateDeleteButtonState($container);
    }
    
    // ========== 拖拽放置提示 ==========
    
    function updateCloneStatus(isValid) {
        if (dragState.clone) {
            if (isValid) {
                dragState.clone.removeClass('invalid').addClass('valid');
                const statusIcon = dragState.clone.find('.clone-status');
                if (statusIcon.length) {
                    statusIcon.text('✅');
                } else {
                    dragState.clone.prepend('<span class="clone-status">✅</span>');
                }
            } else {
                dragState.clone.removeClass('valid').addClass('invalid');
                const statusIcon = dragState.clone.find('.clone-status');
                if (statusIcon.length) {
                    statusIcon.text('❌');
                } else {
                    dragState.clone.prepend('<span class="clone-status">❌</span>');
                }
            }
        }
    }
    
    // ========== 空树事件 ==========
    
    function bindEmptyTreeEvents($container, options) {
        const $emptyArea = $container.find('.simple-tree-empty');
        
        $emptyArea.off('dragover dragleave drop');
        
        $emptyArea.on('dragover', function(e) {
            e.preventDefault();
            if (dragState.sourceNode && dragState.sourceTreeType === 'left' && options.treeType === 'right') {
                $(this).addClass('drag-over-empty');
                updateCloneStatus(true);
                dragState.isValidDrop = true;
                dragState.targetPosition = 'root';
            }
        });
        
        $emptyArea.on('dragleave', function(e) {
            $(this).removeClass('drag-over-empty');
            updateCloneStatus(false);
            dragState.isValidDrop = false;
        });
        
        $emptyArea.on('drop', function(e) {
            e.preventDefault();
            $(this).removeClass('drag-over-empty');
            if (dragState.sourceNode && dragState.sourceTreeType === 'left' && options.treeType === 'right' && dragState.isValidDrop) {
                performDropToEmpty(options);
            }
        });
        
        bindEmptyTreeDragEvents($container, options);
    }
    
    function bindEmptyTreeDragEvents($container, options) {
        let emptyHighlightActive = false;
        
        $(document).on('mousemove.simpleTreeEmpty', function(e) {
            if (!dragState.isDragging) return;
            
            const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
            let isEmptyArea = false;
            for (let i = 0; i < elemUnderCursor.length; i++) {
                if ($(elemUnderCursor[i]).hasClass('simple-tree-empty') ||
                    $(elemUnderCursor[i]).closest('.simple-tree-empty').length) {
                    isEmptyArea = true;
                    break;
                }
            }
            
            const $emptyDiv = $container.find('.simple-tree-empty');
            if (isEmptyArea && !emptyHighlightActive && dragState.sourceTreeType === 'left' && options.treeType === 'right') {
                $emptyDiv.addClass('drag-over-empty');
                emptyHighlightActive = true;
                updateCloneStatus(true);
                dragState.isValidDrop = true;
                dragState.targetPosition = 'root';
            } else if (!isEmptyArea && emptyHighlightActive) {
                $emptyDiv.removeClass('drag-over-empty');
                emptyHighlightActive = false;
                updateCloneStatus(false);
                dragState.isValidDrop = false;
                dragState.targetPosition = null;
            }
        });
        
        $(document).off('mouseup.simpleTreeEmpty');
        $(document).on('mouseup.simpleTreeEmpty', function() {
            $container.find('.simple-tree-empty').removeClass('drag-over-empty');
        });
    }
    
    function performDropToEmpty(options) {
        if (!dragState.sourceNode) return false;
        
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const targetTree = dragState.targetTree;
        
        if (!targetTree) return false;
        
        const targetOptions = targetTree.data('simpleTreeOptions');
        
        if (dragState.sourceTreeType === 'left' && targetOptions && targetOptions.treeType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            
            if (options.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) {
                return false;
            }
            
            targetData = JSON.parse(JSON.stringify(targetData));
            
            const cloned = cloneNode(sourceNode);
            cloned.id = generateId();
            
            targetData.push(cloned);
            
            targetTree.data('treeData', targetData);
            renderTree(targetTree, targetData, targetOptions, true);
            
            if (options.onCopy) {
                options.onCopy(sourceNode, cloned, null, 'root');
            }
            return true;
        }
        
        return false;
    }

    // ========== 事件绑定 ==========
    
    function bindEvents($container, options) {
        // 折叠/展开事件（点击箭头）
        $container.off('click.simpleTree', '.toggle-icon');
        $container.on('click.simpleTree', '.toggle-icon', function(e) {
            e.stopPropagation();
            toggleNode($(this).closest('.tree-node'), options);
        });
        
        // 双击父节点展开/收缩
        $container.off('dblclick.simpleTree', '.tree-node.folder');
        $container.on('dblclick.simpleTree', '.tree-node.folder', function(e) {
            e.stopPropagation();
            e.preventDefault();
            toggleNode($(this), options);
        });
        
        // 节点点击事件（选中节点）
        $container.off('click.simpleTree', '.tree-node');
        $container.on('click.simpleTree', '.tree-node', function(e) {
            e.stopPropagation();
            const $node = $(this);
            const nodeId = $node.data('id');
            
            if (selectedNodeTree) {
                $(selectedNodeTree).find('.tree-node.selected').removeClass('selected');
            }
            
            selectedNodeId = nodeId;
            selectedNodeTree = $container[0];
            selectedNodeTreeType = options.treeType;
            $node.addClass('selected');
            
            updateDeleteButtonState($container);
        });
        
        // 拖拽事件
        $container.off('mousedown.simpleTree', '.tree-node');
        $container.on('mousedown.simpleTree', '.tree-node', function(e) {
            if (e.which !== 1) return;
            if ($(e.target).hasClass('toggle-icon')) return;
            if ($(e.target).hasClass('node-icon')) return;
            
            e.preventDefault();
            startDrag(e, this, $container, options);
        });
    }
    
    function toggleNode($node, options) {
        const $li = $node.closest('li');
        const $children = $li.children('.node-children');
        const $icon = $li.find('.toggle-icon');
        
        if ($children.length && $children.is(':visible')) {
            $children.hide();
            $icon.text('▶');
            const $iconSpan = $node.find('.node-icon');
            $iconSpan.text(options.icons.folder);
        } else if ($children.length) {
            $children.show();
            $icon.text('▼');
            const $iconSpan = $node.find('.node-icon');
            $iconSpan.text(options.icons.folderOpen || options.icons.folder);
        }
    }

    // ========== 拖拽逻辑 ==========
    
    function startDrag(e, nodeEl, $container, options) {
        if (dragState.isDragging) cleanupDrag();
        
        const $node = $(nodeEl);
        const nodeId = $node.data('id');
        
        if (!nodeId) return;
        
        const treeData = $container.data('treeData');
        if (!treeData) return;
        
        const nodeInfo = findNode(treeData, nodeId);
        if (!nodeInfo) return;
        
        dragState.sourceNode = nodeInfo.node;
        dragState.sourceTree = $container;
        dragState.sourceTreeType = options.treeType;
        dragState.sourceId = nodeId;
        dragState.isDragging = true;
        dragState.isValidDrop = false;
        
        $node.addClass('dragging');
        
        const hasChildren = nodeInfo.node.children && nodeInfo.node.children.length > 0;
        const icon = hasChildren ? options.icons.folder : options.icons.file;
        
        dragState.clone = $('<div class="simple-tree-clone invalid">')
            .html(`<span class="clone-status">❌</span><span>${escapeHtml(icon)}</span><span>${escapeHtml(nodeInfo.node.text)}</span>`)
            .css({ top: e.clientY + 10, left: e.clientX + 10 })
            .appendTo('body');
        
        if (options.onDragStart) {
            options.onDragStart(nodeInfo.node, options.treeType);
        }
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).on('mousemove.simpleTree', function(me) {
            onDragMove(me, options);
        });
        $(document).on('mouseup.simpleTree', function(me) {
            onDragEnd(me, options);
        });
    }
    
    function onDragMove(e, options) {
        if (!dragState.isDragging) return;
        e.preventDefault();
        
        if (dragState.clone) {
            dragState.clone.css({ top: e.clientY + 10, left: e.clientX + 10 });
        }
        
        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY);
        let targetNodeEl = null;
        for (let i = 0; i < elemUnderCursor.length; i++) {
            const el = elemUnderCursor[i];
            if ($(el).hasClass('tree-node') && el !== dragState.sourceNode) {
                targetNodeEl = el;
                break;
            }
        }
        
        let isEmptyArea = false;
        if (!targetNodeEl) {
            for (let i = 0; i < elemUnderCursor.length; i++) {
                if ($(elemUnderCursor[i]).hasClass('simple-tree-empty')) {
                    isEmptyArea = true;
                    break;
                }
            }
        }
        
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
            dragState.targetNode = null;
        }
        
        // 空树区域处理（只有右侧树有空白区域）
        if (isEmptyArea && dragState.sourceTreeType === 'left') {
            const $emptyDiv = $('.simple-tree-empty');
            const $targetTree = $emptyDiv.closest('.simple-tree');
            const targetOptions = $targetTree.data('simpleTreeOptions');
            if (targetOptions && targetOptions.treeType === 'right') {
                $emptyDiv.addClass('drag-over-empty');
                dragState.targetTree = $targetTree;
                dragState.targetPosition = 'root';
                dragState.isValidDrop = true;
                updateCloneStatus(true);
                return;
            }
        } else {
            $('.simple-tree-empty').removeClass('drag-over-empty');
        }
        
        // 普通节点目标处理
        if (targetNodeEl) {
            const $targetTree = $(targetNodeEl).closest('.simple-tree');
            const targetOptions = $targetTree.data('simpleTreeOptions');
            const sourceType = dragState.sourceTreeType;
            const targetType = targetOptions ? targetOptions.treeType : null;
            
            if (sourceType && targetType) {
                const targetTreeData = $targetTree.data('treeData') || [];
                const targetNodeId = $(targetNodeEl).data('id');
                const isValidDrop = isValidDropTarget(
                    dragState.sourceNode, sourceType, targetType, targetNodeId, targetTreeData
                );
                
                dragState.targetTree = $targetTree;
                dragState.isValidDrop = isValidDrop;
                updateCloneStatus(isValidDrop);
                
                if (isValidDrop) {
                    const position = getDropPosition(e, targetNodeEl);
                    dragState.targetNode = targetNodeEl;
                    dragState.targetPosition = position;
                    
                    if (position === 'before') {
                        $(targetNodeEl).addClass('drag-over-before');
                    } else if (position === 'after') {
                        $(targetNodeEl).addClass('drag-over-after');
                    } else {
                        $(targetNodeEl).addClass('drag-over-inside');
                    }
                }
            } else {
                dragState.isValidDrop = false;
                updateCloneStatus(false);
            }
        } else {
            dragState.isValidDrop = false;
            updateCloneStatus(false);
        }
    }
    
    function onDragEnd(e, options) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }
        
        let success = false;
        
        if (dragState.isValidDrop) {
            if (dragState.targetPosition === 'root' && dragState.sourceTreeType === 'left') {
                success = performDropToEmpty(dragState.sourceTree.data('simpleTreeOptions'));
            } else if (dragState.targetNode && dragState.targetPosition) {
                const targetId = $(dragState.targetNode).data('id');
                const targetOptions = dragState.targetTree.data('simpleTreeOptions');
                success = performDrop(targetId, dragState.targetPosition, dragState.sourceTree.data('simpleTreeOptions'), targetOptions);
            }
        }
        
        if (options.onDragEnd) {
            options.onDragEnd(dragState.sourceNode, success);
        }
        
        cleanupDrag();
        $('.simple-tree-empty').removeClass('drag-over-empty');
    }
    
    function performDrop(targetId, position, sourceOptions, targetOptions) {
        const sourceNode = dragState.sourceNode;
        const sourceTree = dragState.sourceTree;
        const sourceId = dragState.sourceId;
        const targetTree = dragState.targetTree;
        
        if (!targetTree) return false;
        
        const sourceType = sourceOptions.treeType;
        const targetType = targetOptions.treeType;
        
        let success = false;
        
        // 左 -> 右（复制）
        if (sourceType === 'left' && targetType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            
            if (sourceOptions.duplicateCheck && isNodeNameExists(targetData, sourceNode.text)) {
                return false;
            }
            
            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);
            
            const cloned = cloneNode(sourceNode);
            cloned.id = generateId();
            
            if (insertNode(targetData, targetId, cloned, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOptions, true);
                if (sourceOptions.onCopy) {
                    sourceOptions.onCopy(sourceNode, cloned, targetId, position);
                }
                success = true;
            }
        }
        // 右 -> 右（移动）
        else if (sourceType === 'right' && targetType === 'right') {
            let targetData = targetTree.data('treeData') || [];
            targetData = JSON.parse(JSON.stringify(targetData));
            targetTree.data('treeData', targetData);
            
            if (sourceId == targetId) return false;
            
            removeNode(targetData, sourceId);
            if (insertNode(targetData, targetId, sourceNode, position)) {
                targetTree.data('treeData', targetData);
                renderTree(targetTree, targetData, targetOptions, true);
                if (sourceOptions.onMove) {
                    sourceOptions.onMove(sourceNode, targetId, position);
                }
                success = true;
            }
        }
        
        return success;
    }
    
    function cleanupDrag() {
        if (dragState.sourceNode) {
            $('.tree-node.dragging').removeClass('dragging');
        }
        if (dragState.targetNode) {
            $(dragState.targetNode).removeClass('drag-over-before drag-over-after drag-over-inside');
        }
        if (dragState.clone) {
            dragState.clone.remove();
        }
        
        dragState = {
            sourceNode: null,
            sourceTree: null,
            sourceTreeType: null,
            sourceId: null,
            clone: null,
            targetNode: null,
            targetPosition: null,
            targetTree: null,
            isDragging: false,
            isValidDrop: false
        };
        
        $(document).off('mousemove.simpleTree mouseup.simpleTree');
        $(document).off('mousemove.simpleTreeEmpty mouseup.simpleTreeEmpty');
    }
    
    // ========== 构建工具栏 ==========
    
    function buildToolbar($container, options) {
        const $toolbar = $('<div class="simple-tree-toolbar"></div>');
        
        const $addBtn = $('<button class="add-btn">➕ 添加节点</button>');
        $addBtn.on('click', function() {
            let targetId = null;
            if (selectedNodeTree === $container[0] && selectedNodeId) {
                targetId = selectedNodeId;
            }
            showAddNodeDialog($container, options, targetId);
        });
        $toolbar.append($addBtn);
        
        const $deleteBtn = $('<button class="delete-btn disabled" disabled>🗑 删除节点</button>');
        $deleteBtn.on('click', function() {
            if (!$(this).hasClass('disabled')) {
                deleteSelectedNode($container, options);
            }
        });
        $toolbar.append($deleteBtn);
        
        const $searchInput = $('<input type="text" class="search-input" placeholder="🔍 搜索节点...">');
        const $searchClear = $('<button class="search-clear">✖ 清除</button>');
        
        let searchTimeout;
        $searchInput.on('input', function() {
            clearTimeout(searchTimeout);
            const keyword = $(this).val();
            searchTimeout = setTimeout(() => {
                performSearch($container, keyword, options);
            }, 300);
        });
        
        $searchClear.on('click', function() {
            $searchInput.val('');
            clearHighlights($container);
            currentSearchKeyword = '';
        });
        
        $toolbar.append($searchInput);
        $toolbar.append($searchClear);
        
        $container.before($toolbar);
    }
    
    // ========== 插件入口 ==========
    
    $.fn.simpleTree = function(userOptions) {
        const options = $.extend(true, {}, defaults, userOptions);
        
        return this.each(function() {
            const $this = $(this);
            $this.addClass('simple-tree');
            
            // 存储配置，供拖拽时使用
            $this.data('simpleTreeOptions', options);
            
            function ensureId(nodes) {
                if (!nodes) return;
                for (let i = 0; i < nodes.length; i++) {
                    if (!nodes[i].id) {
                        nodes[i].id = generateId();
                    }
                    if (nodes[i].children) {
                        ensureId(nodes[i].children);
                    }
                }
            }
            
            // 只为右侧树添加工具栏
            if (options.treeType === 'right') {
                buildToolbar($this, options);
            }
            
            let dataToRender = options.data;
            if (dataToRender && dataToRender.length) {
                const dataCopy = JSON.parse(JSON.stringify(dataToRender));
                ensureId(dataCopy);
                $this.data('treeData', dataCopy);
                renderTree($this, dataCopy, options, false);
            } else if (options.allowDropToEmpty && options.treeType === 'right') {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            } else {
                $this.data('treeData', []);
                renderTree($this, [], options, false);
            }
        });
    };
    
})(jQuery);