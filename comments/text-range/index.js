/**
 * 判断是否是文本节点
 */
function isTextNode(node) {
    return node.nodeType === 3;
}
/**
 * 判断是否是非空文本节点
 */
function isPlainTextNode(node) {
    return node.nodeType === 3 && !!node.wholeText.length;
}
/**
 * 获取节点的区间内所有元素的 DOMRect
 * 文本节点换行后会被切分多个 DOMRect
 */
function getTextNodeRects(node, startOffset, endOffset) {
    if (startOffset === undefined)
        startOffset = 0;
    if (endOffset === undefined)
        endOffset = node.textContent.length;
    const range = document.createRange();
    range.setStart(node, startOffset);
    range.setEnd(node, endOffset);
    return Array.from(range.getClientRects()).filter((o) => o.width !== 0 && o.height !== 0);
}
/**
 * 获取 Range 内的文本
 */
function getStartAndEndRangeText(range) {
    const { startContainer, endContainer, startOffset, endOffset } = range;
    let startText = '';
    let endText = '';
    if (isSingle(range)) {
        startText = endText = sliceText(startContainer, startOffset, endOffset);
    }
    else {
        startText = sliceText(startContainer, startOffset);
        endText = sliceText(endContainer, 0, endOffset);
    }
    return {
        start: startText,
        end: endText,
    };
}
/**
 * 获取节点中某区间的文本
 */
function sliceText(node, startOffset, endOffset) {
    return node.textContent ? node.textContent.slice(startOffset, endOffset) : '';
}
/**
 * 从节点开始, 遍历往后的文本节点
 */
function* nodeAfterIterator(node, isGoBack = false) {
    yield node;
    if (!isGoBack && node.childNodes.length > 0) {
        yield* nodeAfterIterator(node.childNodes[0], false);
    }
    else if (node.nextSibling) {
        yield* nodeAfterIterator(node.nextSibling, false);
    }
    else if (node.parentNode) {
        yield* nodeAfterIterator(node.parentNode, true);
    }
}
/**
 * 获取 Range 内的所有非空文本节点
 */
function* nodeRangeIterator(range) {
    const { startContainer, endContainer } = range;
    if (isSingle(range)) {
        if (isPlainTextNode(startContainer)) {
            yield startContainer;
        }
        return;
    }
    const iterator = nodeAfterIterator(startContainer);
    let nextNode = iterator.next().value; // startContainer
    while (nextNode && nextNode !== endContainer) {
        if (isPlainTextNode(nextNode)) {
            yield nextNode;
        }
        nextNode = iterator.next().value;
    }
    if (nextNode && isPlainTextNode(nextNode)) {
        yield nextNode; // endContainer
    }
}
/**
 * 判断选中文本是否只有一个节点
 */
function isSingle(range) {
    const { startContainer, endContainer } = range;
    return startContainer === endContainer;
}
/**
 * 判断2个DOMRect是否水平方向相邻
 */
function compareBoundaryRects(origin, target) {
    const nextX = origin.left + origin.width;
    if (nextX > 0 && nextX === target.left) {
        return true;
    }
    return false;
}

let id = 0;
class TextRange {
    constructor(options = {}) {
        var _a;
        /**
         * 是否裁剪过文本节点
         * @default false
         */
        this.split = false;
        const { container, range, id, splitText = false } = options;
        this.options = options;
        this.root = container !== null && container !== void 0 ? container : document.body;
        let selection;
        const _range = range !== null && range !== void 0 ? range : (((_a = (selection = getSelection())) === null || _a === void 0 ? void 0 : _a.isCollapsed)
            ? undefined
            : selection.getRangeAt(0));
        if (_range == null) {
            throw new Error('range parameter is reqired.');
        }
        this.range = _range;
        this.id = id !== null && id !== void 0 ? id : TextRange.generateId();
        splitText && this.splitText();
        if (this.isEmpty) {
            console.warn(`ID: ${this.id}, No text selected.`);
        }
    }
    *[Symbol.iterator]() {
        yield* nodeRangeIterator(this.range);
    }
    get single() {
        return isSingle(this.range);
    }
    get text() {
        return this.range.toString();
    }
    get textNodes() {
        return [...this];
    }
    get trimTextNode() {
        const { textNodes } = this;
        textNodes.shift();
        textNodes.pop();
        return textNodes;
    }
    get rect() {
        return this.range.getBoundingClientRect();
    }
    /**
     * 获取所有元素的 DOMRect
     */
    get rects() {
        if (this.isEmpty)
            return [];
        const rects = [];
        const { startContainer, startOffset, endContainer, endOffset } = this.range;
        if (this.single) {
            rects.push(...getTextNodeRects(startContainer, startOffset, endOffset));
            return rects;
        }
        rects.push(...getTextNodeRects(startContainer, startOffset));
        for (const textNode of this.trimTextNode) {
            rects.push(...getTextNodeRects(textNode));
        }
        rects.push(...getTextNodeRects(endContainer, 0, endOffset));
        return rects;
    }
    /**
     * 水平方向相邻的 DOMRect 合并
     */
    get mergeRects() {
        const { rects } = this;
        const mergeRects = [];
        let rect = rects[0];
        rects.reduce((pre, cur) => {
            if (compareBoundaryRects(pre, cur)) {
                rect.width += cur.width;
                rect.height = Math.max(rect.height, cur.height);
                rect.y = Math.min(rect.y, cur.y);
            }
            else {
                mergeRects.push(rect);
                rect = cur;
            }
            return pre;
        }, rect);
        return mergeRects;
    }
    get data() {
        const { startContainer, endContainer, startOffset, endOffset } = this.range;
        const { start, end } = getStartAndEndRangeText(this.range);
        return {
            id: this.id,
            text: this.range.toString(),
            start: {
                path: TextRange.getPath(startContainer, this.root),
                offset: startOffset,
                text: start,
            },
            end: {
                path: TextRange.getPath(endContainer, this.root),
                offset: endOffset,
                text: end,
            },
        };
    }
    get isEmpty() {
        return this.range.collapsed;
    }
    /**
     * 替换文本节点
     */
    replace(render) {
        if (!this.options.splitText)
            this.splitText();
        const { textNodes } = this;
        textNodes.forEach((o) => {
            const { parentNode, nextSibling } = o;
            if (parentNode == null)
                return;
            const newNode = render(o);
            if (nextSibling) {
                parentNode.insertBefore(newNode, nextSibling);
            }
            else {
                parentNode.appendChild(newNode);
            }
        });
    }
    /**
     * 裁剪开始节点和结束节点
     */
    splitText() {
        this.split = true;
        const { startContainer, startOffset, endContainer, endOffset } = this.range;
        if (this.single) {
            if (isTextNode(startContainer) && startOffset !== endOffset) {
                isTextNode(endContainer) && endContainer.splitText(endOffset);
                startContainer.splitText(startOffset);
                startContainer.nextSibling && this.range.setStart(startContainer.nextSibling, 0);
            }
            return;
        }
        if (isTextNode(startContainer)) {
            startContainer.splitText(startOffset);
            console.log('startContainer.nextSibling', startContainer.nextSibling);
            startContainer.nextSibling && this.range.setStart(startContainer.nextSibling, 0);
        }
        if (isTextNode(endContainer)) {
            endContainer.splitText(endOffset);
        }
    }
    /**
     * 包含改节点 && 改节点是文本节点
     */
    isValidTextNode(node) {
        return (this.range.commonAncestorContainer.contains(node) && isPlainTextNode(node));
    }
    static generateId() {
        return id++;
    }
    /**
     * 根据配置创建 TextRange
     */
    static create(config, root) {
        const range = this.createRange(config, root);
        return new TextRange({ id, range, container: root });
    }
    /**
     * 根据配置创建 Range
     */
    static createRange(config, root) {
        root = root !== null && root !== void 0 ? root : document.body;
        const range = document.createRange();
        const { start, end } = config;
        range.setStart(this.getNodeByPath(start.path, root), start.offset);
        range.setEnd(this.getNodeByPath(end.path, root), end.offset);
        return range;
    }
    /**
     * 获取指定节点的 path
     * 用户修改文本后尽可能不影响选中的位置
     */
    static getPath(textNode, root) {
        let parentElement = textNode.parentElement;
        const path = [
            0,
            Array.from(parentElement.childNodes).findIndex((o) => textNode === o),
        ];
        let cur = parentElement;
        parentElement = parentElement.parentElement;
        while (parentElement) {
            if (cur === parentElement.firstElementChild) {
                if (parentElement === root) {
                    break;
                }
                else {
                    cur = parentElement;
                    parentElement = cur.parentElement;
                    path.unshift(0);
                }
            }
            else {
                cur = cur.previousElementSibling;
                path[0]++;
            }
        }
        if (parentElement == null) {
            throw new Error('The text node must be in the root container.');
        }
        return path;
    }
    /**
     * 根据 path 获取指定节点
     */
    static getNodeByPath(path, root) {
        let node = root;
        path.reduce((_node, index, i) => {
            if (node == null)
                return node;
            const isLast = i === path.length - 1;
            const childs = isLast ? _node.childNodes : _node.children;
            if (childs[index]) {
                node = childs[index];
            }
            return node;
        }, node);
        return node;
    }
}

export { TextRange as default };
