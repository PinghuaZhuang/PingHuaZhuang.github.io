import TextRange from './lib.js';

function throttling(fn, delay = 200) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(args), delay);
  };
}

function createClickHandle(fn) {
  return function (e) {
    const target = e.target;
    if ('once' in e.target.dataset && target.classList.contains('primary')) {
      return;
    }
    if ('once' in e.target.dataset) {
      target.classList.add('disabled');
    }
    target.classList.toggle('primary');
    fn(e);
  };
}

const rects = document.querySelector('#rects');
const table = document.querySelector('#table');
const tbody = document.querySelector('#table tbody');
let hilightFlag = true;

window.TextRange = TextRange;
window.instances = [];

function renderTable() {
  tbody.innerHTML = '';
  table.style.display = instances.length ? 'table' : 'none';
  instances.forEach((o) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td data-label="ID">${
      o.id
    }</td><td data-label="text-content">${o.text()}</td>`;
    tbody.appendChild(tr);
  });
}

const hilight = (textNode) => {
  if (
    textNode.textContent == null ||
    !textNode.textContent.trim() ||
    !hilightFlag
  )
    return;
  const nrmark = document.createElement('nrmark');
  nrmark.appendChild(textNode);
  return nrmark;
};

const removeHilights = () => {
  if (instances.every(r => r.textNodes().every(o => o.parentNode.nodeName !== 'NRMARK'))) return;
  instances.forEach((r) => {
    const tnodes = r.textNodes();
    tnodes.forEach((o) => {
      const nrmark = o.parentNode;
      const { parentNode, nextSibling } = nrmark;
      const newNode = new Text(o.wholeText);
      if (parentNode == null) return;
      if (
        nrmark.nodeName === 'NRMARK' &&
        Array.from(nrmark.childNodes).every((q) => q.nodeName !== 'NRMARK')
      ) {
        // const childNodes = Array.from(nrmark.childNodes);
        if (nextSibling) {
          parentNode.insertBefore(newNode, nextSibling);
          // childNodes.forEach(q => parentNode.insertBefore(q, nextSibling));
        } else {
          parentNode.appendChild(newNode);
          // childNodes.forEach(q => parentNode.appendChild(q));
        }
        nrmark.remove();
      }
    });
    r.update();
  });
  removeHilights();
};
window.removeHilights = removeHilights;

const renderRects = function (textRange, isRect) {
  const key = isRect ? 'rects' : 'mergeRects';
  const domrects = textRange[key]();
  console.log(`${key}:`, domrects);
  domrects.forEach((rect) => {
    const div = document.createElement('div');
    div.style.width = `${rect.width}px`;
    div.style.height = `${rect.height}px`;
    div.style.left = `${rect.left}px`;
    div.style.top = `${rect.top}px`;
    div.classList.add('hilight');
    div.classList.add(isRect ? 'rect' : 'merge');
    rects.append(div);
  });
};
window.renderRects = renderRects;

document.addEventListener(
  'mouseup',
  throttling(function (e) {
    if (getSelection().isCollapsed) return;
    var r = new TextRange();
    console.log('creatTextRange:', r);
    instances.push(r);
    renderTable();
    r.replace(hilight);
    getSelection().collapseToStart();
  }),
);

window.addEventListener('DOMContentLoaded', (e) => {
  const hilightBtn = document.querySelector('#hilight');
  hilightBtn.addEventListener(
    'click',
    createClickHandle((e) => {
      const target = e.target;
      if (target.classList.contains('primary')) {
        hilightFlag = true;
        instances.forEach((o) => o.replace(hilight));
      } else {
        hilightFlag = false;
        removeHilights();
      }
    }),
  );

  const exportBtn = document.querySelector('#export');
  const importBtn = document.querySelector('#import');
  exportBtn.addEventListener(
    'click',
    createClickHandle(() => {
      localStorage.setItem(
        'test',
        JSON.stringify(instances.map((o) => o.data)),
      );
    }),
  );
  importBtn.addEventListener(
    'click',
    createClickHandle((e) => {
      const importDatas = JSON.parse(localStorage.getItem('test'));
      importDatas.forEach((o) => {
        const r = TextRange.create(o);
        instances.push(r);
        renderTable();
        r.replace(hilight);
      });
    }),
  );

  const refreshBtn = document.querySelector('#refresh');
  refreshBtn.addEventListener('click', () => {
    // window.location.reload();
    removeHilights();
    Array.from(document.querySelectorAll('.hilight')).forEach((o) =>
      o.remove(),
    );
    instances = [];
    renderTable();
  });

  const drawBtn = document.querySelector('#draw');
  const drawMergeBtn = document.querySelector('#drawMerge');
  drawBtn.addEventListener(
    'click',
    createClickHandle((e) => {
      if (e.target.classList.contains('primary')) {
        instances.forEach((o) => renderRects(o, true));
      } else {
        Array.from(document.querySelectorAll('.hilight.rect')).forEach((o) =>
          o.remove(),
        );
      }
    }),
  );
  drawMergeBtn.addEventListener(
    'click',
    createClickHandle((e) => {
      if (e.target.classList.contains('primary')) {
        instances.forEach((o) => renderRects(o));
      } else {
        Array.from(document.querySelectorAll('.hilight.merge')).forEach((o) =>
          o.remove(),
        );
      }
    }),
  );
});
