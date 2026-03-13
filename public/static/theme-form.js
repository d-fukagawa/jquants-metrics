(function () {
  const root = document.getElementById('theme-form-root');
  if (!root) return;

  const input = document.getElementById('theme-stock-search-input');
  const searchBtn = document.getElementById('theme-stock-search-btn');
  const resultsEl = document.getElementById('theme-stock-search-results');
  const selectedEl = document.getElementById('theme-stock-selected');
  const hiddenEl = document.getElementById('theme-stock-hidden');

  if (!input || !searchBtn || !resultsEl || !selectedEl || !hiddenEl) return;

  let selected = [];
  try {
    selected = JSON.parse(decodeURIComponent(root.dataset.initial || '[]'));
  } catch (_error) {
    selected = [];
  }

  function codeExists(code4) {
    return selected.some((row) => row.code4 === code4);
  }

  function renderHidden() {
    hiddenEl.innerHTML = '';
    selected.forEach((row) => {
      const inputEl = document.createElement('input');
      inputEl.type = 'hidden';
      inputEl.name = 'codes[]';
      inputEl.value = row.code4;
      hiddenEl.appendChild(inputEl);
    });
  }

  function renderSelected() {
    selectedEl.innerHTML = '';
    if (selected.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.style.padding = '8px 0';
      empty.style.textAlign = 'left';
      empty.textContent = '銘柄を追加してください（1〜6銘柄）';
      selectedEl.appendChild(empty);
      renderHidden();
      return;
    }

    const table = document.createElement('table');
    table.className = 'fav-table';
    table.innerHTML = '<thead><tr><th>順序</th><th>コード</th><th>銘柄名</th><th class="r">操作</th></tr></thead>';
    const tbody = document.createElement('tbody');

    selected.forEach((row, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${index + 1}</td>
        <td><span class="code">${row.code4}</span></td>
        <td>${row.coName || row.code4}</td>
        <td class="r">
          <button type="button" class="btn-sm js-up">↑</button>
          <button type="button" class="btn-sm js-down">↓</button>
          <button type="button" class="btn-sm js-remove">削除</button>
        </td>
      `;

      tr.querySelector('.js-up').addEventListener('click', () => {
        if (index === 0) return;
        const prev = selected[index - 1];
        selected[index - 1] = selected[index];
        selected[index] = prev;
        renderSelected();
      });

      tr.querySelector('.js-down').addEventListener('click', () => {
        if (index === selected.length - 1) return;
        const next = selected[index + 1];
        selected[index + 1] = selected[index];
        selected[index] = next;
        renderSelected();
      });

      tr.querySelector('.js-remove').addEventListener('click', () => {
        selected.splice(index, 1);
        renderSelected();
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    selectedEl.appendChild(table);
    renderHidden();
  }

  function renderSearchResults(rows) {
    resultsEl.innerHTML = '';
    if (!rows || rows.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.style.padding = '8px 0';
      empty.style.textAlign = 'left';
      empty.textContent = '一致する銘柄が見つかりません';
      resultsEl.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'fav-table';
    table.innerHTML = '<thead><tr><th>コード</th><th>銘柄名</th><th>市場</th><th class="r">操作</th></tr></thead>';
    const tbody = document.createElement('tbody');

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="code">${row.code4}</span></td>
        <td>${row.coName}</td>
        <td>${row.mktNm || '—'}</td>
        <td class="r"><button type="button" class="btn-sm">追加</button></td>
      `;
      tr.querySelector('button').addEventListener('click', () => {
        if (codeExists(row.code4)) return;
        if (selected.length >= 6) {
          window.alert('テーマ銘柄は最大6件です');
          return;
        }
        selected.push({
          code: row.code,
          code4: row.code4,
          coName: row.coName,
        });
        renderSelected();
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    resultsEl.appendChild(table);
  }

  async function runSearch() {
    const q = String(input.value || '').trim();
    if (!q) return;

    try {
      const res = await fetch(`/themes/stock-search?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('search failed');
      const data = await res.json();
      renderSearchResults(data.rows || []);
    } catch (_error) {
      resultsEl.innerHTML = '<p class="empty-state" style="padding:8px 0;text-align:left">検索に失敗しました</p>';
    }
  }

  searchBtn.addEventListener('click', runSearch);
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runSearch();
  });

  renderSelected();
})();
