(function () {
  const roots = Array.from(document.querySelectorAll('.theme-notes-root'));
  if (roots.length === 0) return;

  const MAX_NOTES = 20;

  function normalizeNote(note) {
    const label = String((note && note.label) || '').trim().slice(0, 100);
    const text = String((note && note.text) || '').trim().slice(0, 5000);
    if (!label && !text) return null;
    return { label, text };
  }

  function parseInitial(raw) {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(normalizeNote)
        .filter((note) => note !== null);
    } catch (_error) {
      return [];
    }
  }

  function ensureAtLeastOne(notes) {
    if (notes.length > 0) return notes;
    return [{ label: '', text: '' }];
  }

  roots.forEach((root) => {
    const hiddenName = root.dataset.inputName || 'memo';
    const hiddenInput = document.createElement('input');
    hiddenInput.type = 'hidden';
    hiddenInput.name = hiddenName;

    let notes = ensureAtLeastOne(parseInitial(root.dataset.initial || ''));

    function serializeNotes() {
      const normalized = notes
        .map(normalizeNote)
        .filter((note) => note !== null);
      if (normalized.length === 0) return '';
      return JSON.stringify(normalized);
    }

    function render() {
      root.innerHTML = '';

      const list = document.createElement('div');
      list.className = 'theme-note-list';

      notes.forEach((note, index) => {
        const card = document.createElement('div');
        card.className = 'theme-note-card';

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'input theme-note-label';
        labelInput.setAttribute('aria-label', 'ラベル');
        labelInput.maxLength = 100;
        labelInput.placeholder = 'ラベル（例: 仮説 / 懸念 / 追跡指標）';
        labelInput.value = note.label || '';
        labelInput.addEventListener('input', () => {
          notes[index].label = labelInput.value;
          hiddenInput.value = serializeNotes();
        });

        const textArea = document.createElement('textarea');
        textArea.className = 'theme-note-text';
        textArea.setAttribute('aria-label', 'テキスト');
        textArea.maxLength = 5000;
        textArea.placeholder = 'ノート内容を入力';
        textArea.value = note.text || '';
        textArea.addEventListener('input', () => {
          notes[index].text = textArea.value;
          hiddenInput.value = serializeNotes();
        });

        const actions = document.createElement('div');
        actions.className = 'theme-note-actions';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'btn-sm';
        upBtn.textContent = '↑';
        upBtn.disabled = index === 0;
        upBtn.addEventListener('click', () => {
          if (index === 0) return;
          const prev = notes[index - 1];
          notes[index - 1] = notes[index];
          notes[index] = prev;
          render();
        });

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'btn-sm';
        downBtn.textContent = '↓';
        downBtn.disabled = index === notes.length - 1;
        downBtn.addEventListener('click', () => {
          if (index === notes.length - 1) return;
          const next = notes[index + 1];
          notes[index + 1] = notes[index];
          notes[index] = next;
          render();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-sm';
        removeBtn.textContent = '削除';
        removeBtn.disabled = notes.length <= 1;
        removeBtn.addEventListener('click', () => {
          if (notes.length <= 1) {
            notes[0] = { label: '', text: '' };
          } else {
            notes.splice(index, 1);
          }
          notes = ensureAtLeastOne(notes);
          render();
        });

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(removeBtn);

        card.appendChild(labelInput);
        card.appendChild(textArea);
        card.appendChild(actions);
        list.appendChild(card);
      });

      const footer = document.createElement('div');
      footer.className = 'theme-note-footer';

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn-sm';
      addBtn.textContent = 'ノート追加';
      addBtn.addEventListener('click', () => {
        if (notes.length >= MAX_NOTES) {
          window.alert(`ノートは最大${MAX_NOTES}件です`);
          return;
        }
        notes.push({ label: '', text: '' });
        render();
      });

      footer.appendChild(addBtn);
      root.appendChild(list);
      root.appendChild(footer);
      root.appendChild(hiddenInput);
      hiddenInput.value = serializeNotes();
    }

    render();
  });
})();
