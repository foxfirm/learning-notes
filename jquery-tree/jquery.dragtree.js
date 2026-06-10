/**
 * jQuery DragTree - 修复复制后右侧树拖拽失效问题
 */
(function($) {
    'use strict';

    const defaults = {
        data: [],
        enableLeftToRight: true,
        enableRightReorder: true,
        defaultCollapsed: true,
        onCopy: null,
        onMove: null,
        onDragStart: null,
        onDragEnd: null,
        onToggle: null,
        renderNode: null
    };

    let dragState = {
        sourceLi: null,
        sourceTreeId: null,
        sourceNodeData: null,
        clone: null,
        currentTarget: null,
        isDragging: false
    };

    // ========== 工具函数 ==========
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function escapeJson(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function getNodeDataFromLi(li) {
        const dataAttr = $(li).attr('data-node-data');
        if (dataAttr) {
            try {
                const decoded = dataAttr.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                return JSON.parse(decoded);
            } catch(e) {
                console.warn('解析节点数据失败', e);
            }
        }
        return { id: $(li).attr('data-id'), text: $(li).find('.node-text').first().text() };
    }

    function getTreeType($tree) {
        let type = $tree.data('dragtree-type');
        if (!type) {
            const id = $tree.attr('id');
            if (id === 'leftTree') type = 'left';
            else if (id === 'rightTree') type = 'right';
            else type = 'unknown';
            $tree.data('dragtree-type', type);
        }
        return type;
    }

    function getTreeTypeFromLi(li) {
        return getTreeType($(li).closest('[data-dragtree]'));
    }

    function getDropPosition(e, targetLi) {
        const rect = targetLi.getBoundingClientRect();
        const y = e.clientY;
        const height = rect.height;
        const relativeY = y - rect.top;
        if (relativeY < height * 0.33) return 'before';
        if (relativeY > height * 0.66) return 'after';
        return 'inside';
    }

    // ========== 数据操作函数 ==========
    function removeNodeFromTree(tree, nodeId) {
        for (let i = 0; i < tree.length; i++) {
            const node = tree[i];
            if (node.id == nodeId) {
                tree.splice(i, 1);
                return node;
            }
            if (node.children && node.children.length) {
                const removed = removeNodeFromTree(node.children, nodeId);
                if (removed) return removed;
            }
        }
        return null;
    }

    function insertNodeToTree(tree, targetId, newNode, position) {
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
            if (node.children && node.children.length) {
                const inserted = insertNodeToTree(node.children, targetId, newNode, position);
                if (inserted) return inserted;
            }
        }
        return false;
    }

    function isDescendantOf(parentNode, childId) {
        if (!parentNode.children) return false;
        for (let child of parentNode.children) {
            if (child.id == childId) return true;
            if (isDescendantOf(child, childId)) return true;
        }
        return false;
    }

    // ========== 渲染函数 ==========
    function renderTree($container, data, options) {
        if (!data || !data.length) {
            $container.html('<ul><li>无数据</li></ul>');
            return;
        }
        
        function buildHtml(nodes, level = 0) {
            let html = '<ul>';
            for (let i = 0; i < nodes.length; i++) {
                const node = nodes[i];
                const nodeId = node.id || `node_${Date.now()}_${i}_${Math.random()}`;
                const hasChildren = node.children && node.children.length > 0;
                
                let label = '';
                if (options.renderNode) {
                    label = options.renderNode(node);
                } else {
                    label = `<span class="node-text">${escapeHtml(node.text || node.name || '未命名')}</span>`;
                }
                
                const collapsedClass = (options.defaultCollapsed && hasChildren) ? 'collapsed' : '';
                
                html += `<li data-id="${nodeId}" data-node-data='${escapeJson(JSON.stringify(node))}' class="${collapsedClass}">`;
                html += `<div class="node-wrapper">`;
                
                if (hasChildren) {
                    html += `<span class="toggle-icon">${collapsedClass === 'collapsed' ? '▶' : '▼'}</span>`;
                } else {
                    html += `<span class="toggle-icon empty"></span>`;
                }
                
                html += `<span class="node-content">${label}</span>`;
                html += `</div>`;
                
                if (hasChildren) {
                    html += buildHtml(node.children, level + 1);
                }
                html += '</li>';
            }
            html += '</ul>';
            return html;
        }
        
        $container.html(buildHtml(data));
        
        // 重新绑定所有事件（关键：确保新生成的节点可拖拽）
        bindToggleEvents($container, options);
        bindDragEvents($container, options);
    }
    
    // ========== 折叠/展开事件 ==========
    function bindToggleEvents($container, options) {
        $container.off('click.dragtree', '.toggle-icon');
        $container.on('click.dragtree', '.toggle-icon', function(e) {
            e.stopPropagation();
            
            const $icon = $(this);
            const $li = $icon.closest('li');
            const isCollapsed = $li.hasClass('collapsed');
            const hasChildren = $li.children('ul').length > 0;
            
            if (!hasChildren) return;
            
            if (isCollapsed) {
                $li.removeClass('collapsed');
                $icon.text('▼');
                if (options.onToggle) {
                    options.onToggle(getNodeDataFromLi($li[0]), 'expanded');
                }
            } else {
                $li.addClass('collapsed');
                $icon.text('▶');
                if (options.onToggle) {
                    options.onToggle(getNodeDataFromLi($li[0]), 'collapsed');
                }
            }
        });
    }
    
    // ========== 拖拽事件 ==========
    function clearHighlight() {
        if (dragState.currentTarget) {
            $(dragState.currentTarget).removeClass('drag-over');
            dragState.currentTarget = null;
        }
    }
    
    function highlightTarget(targetLi) {
        if (dragState.currentTarget === targetLi) return;
        clearHighlight();
        dragState.currentTarget = targetLi;
        $(targetLi).addClass('drag-over');
    }
    
    function destroyClone() {
        if (dragState.clone && dragState.clone.length) {
            dragState.clone.remove();
            dragState.clone = null;
        }
        $('.drag-clone').remove();
    }
    
    function createClone(li, clientX, clientY) {
        destroyClone();
        const $clone = $(li).clone();
        $clone.addClass('drag-clone');
        $clone.css({
            top: clientY + 10,
            left: clientX + 10,
            position: 'fixed',
            zIndex: 9999,
            pointerEvents: 'none'
        });
        $('body').append($clone);
        return $clone;
    }
    
    function updateClonePosition(e) {
        if (dragState.clone && dragState.clone.length) {
            dragState.clone.css({
                top: e.clientY + 10,
                left: e.clientX + 10
            });
        }
    }
    
    function cleanupDrag() {
        if (dragState.sourceLi) {
            $(dragState.sourceLi).removeClass('dragging');
        }
        clearHighlight();
        destroyClone();
        dragState = {
            sourceLi: null,
            sourceTreeId: null,
            sourceNodeData: null,
            clone: null,
            currentTarget: null,
            isDragging: false
        };
        $(document).off('mousemove.dragtree mouseup.dragtree');
    }
    
    // 执行放置操作
    function performDrop(targetLi, dropPosition, options) {
        if (!dragState.sourceLi || !targetLi) return false;
        
        const $sourceTree = $(dragState.sourceLi).closest('[data-dragtree]');
        const $targetTree = $(targetLi).closest('[data-dragtree]');
        const sourceType = dragState.sourceTreeId;
        const targetType = getTreeTypeFromLi(targetLi);
        const sourceNodeData = dragState.sourceNodeData;
        const targetNodeData = getNodeDataFromLi(targetLi);
        
        let success = false;
        
        // 左侧 -> 右侧（复制）
        if (sourceType === 'left' && targetType === 'right' && options.enableLeftToRight) {
            const clonedNode = JSON.parse(JSON.stringify(sourceNodeData));
            clonedNode.id = `${clonedNode.id || 'node'}_copy_${Date.now()}_${Math.random()}`;
            const targetTreeData = $targetTree.data('dragtree-data') || [];
            const inserted = insertNodeToTree(targetTreeData, targetNodeData.id, clonedNode, dropPosition);
            if (inserted) {
                // 更新数据存储
                $targetTree.data('dragtree-data', targetTreeData);
                // 重新渲染右侧树
                renderTree($targetTree, targetTreeData, options);
                if (options.onCopy) {
                    options.onCopy(sourceNodeData, clonedNode, targetNodeData, dropPosition);
                }
                success = true;
            }
        }
        // 右侧 -> 右侧（移动）
        else if (sourceType === 'right' && targetType === 'right' && options.enableRightReorder) {
            const targetTreeData = $targetTree.data('dragtree-data') || [];
            
            if (sourceNodeData.id == targetNodeData.id) return false;
            if (isDescendantOf(sourceNodeData, targetNodeData.id)) return false;
            
            const removedNode = removeNodeFromTree(targetTreeData, sourceNodeData.id);
            if (removedNode) {
                const inserted = insertNodeToTree(targetTreeData, targetNodeData.id, removedNode, dropPosition);
                if (inserted) {
                    $targetTree.data('dragtree-data', targetTreeData);
                    renderTree($targetTree, targetTreeData, options);
                    if (options.onMove) {
                        options.onMove(removedNode, targetNodeData, dropPosition);
                    }
                    success = true;
                }
            }
        }
        
        // 重要：清理拖拽状态，防止残留影响后续操作
        cleanupDrag();
        
        return success;
    }
    
    function onDragMove(e, options) {
        if (!dragState.isDragging) return;
        e.preventDefault();
        updateClonePosition(e);
        
        const elemUnderCursor = document.elementsFromPoint(e.clientX, e.clientY)[0];
        const targetLi = elemUnderCursor ? $(elemUnderCursor).closest('li')[0] : null;
        
        if (targetLi) {
            const targetType = getTreeTypeFromLi(targetLi);
            const sourceType = dragState.sourceTreeId;
            
            const isValid = (sourceType === 'left' && targetType === 'right') ||
                           (sourceType === 'right' && targetType === 'right');
            
            if (isValid) {
                highlightTarget(targetLi);
                $(targetLi).data('dropPos', getDropPosition(e, targetLi));
            } else {
                clearHighlight();
            }
        } else {
            clearHighlight();
        }
    }
    
    function onDragEnd(e, options) {
        if (!dragState.isDragging) {
            cleanupDrag();
            return;
        }
        
        let finalTarget = null;
        let finalPos = 'inside';
        
        if (dragState.currentTarget) {
            finalTarget = dragState.currentTarget;
            finalPos = $(finalTarget).data('dropPos') || getDropPosition(e, finalTarget);
            performDrop(finalTarget, finalPos, options);
        } else {
            cleanupDrag();
        }
        
        if (options.onDragEnd) {
            options.onDragEnd(dragState.sourceLi, finalTarget, finalTarget !== null);
        }
    }
    
    function onDragStart(e, options) {
        // 点击箭头不触发拖拽
        if ($(e.target).hasClass('toggle-icon')) return;
        
        const li = e.target.closest('li');
        if (!li) return;
        
        e.preventDefault();
        if (dragState.isDragging) cleanupDrag();
        
        dragState.sourceLi = li;
        dragState.sourceTreeId = getTreeTypeFromLi(li);
        dragState.sourceNodeData = getNodeDataFromLi(li);
        dragState.isDragging = true;
        
        $(li).addClass('dragging');
        dragState.clone = createClone(li, e.clientX, e.clientY);
        
        if (options.onDragStart) {
            options.onDragStart(li, dragState.sourceTreeId);
        }
        
        // 绑定全局事件
        $(document).off('mousemove.dragtree mouseup.dragtree');
        $(document).on('mousemove.dragtree', function(me) { onDragMove(me, options); });
        $(document).on('mouseup.dragtree', function(me) { onDragEnd(me, options); });
    }
    
    function bindDragEvents($tree, options) {
        $tree.off('mousedown.dragtree');
        $tree.on('mousedown.dragtree', 'li', function(e) {
            if (e.which !== 1) return;
            onDragStart(e, options);
        });
    }
    
    // ========== 插件入口 ==========
    $.fn.dragtree = function(userOptions) {
        const options = $.extend({}, defaults, userOptions);
        
        return this.each(function() {
            const $this = $(this);
            $this.attr('data-dragtree', 'true');
            
            if (options.data && options.data.length) {
                $this.data('dragtree-data', options.data);
                renderTree($this, options.data, options);
            }
            
            const type = $this.data('dragtree-type') || 
                         ($this.attr('id') === 'leftTree' ? 'left' : 
                          $this.attr('id') === 'rightTree' ? 'right' : 'unknown');
            $this.data('dragtree-type', type);
            $this.data('dragtree-options', options);
        });
    };
    
})(jQuery);