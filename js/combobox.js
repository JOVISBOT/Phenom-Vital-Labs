/**
 * Type-ahead picker over the peptide list.
 *
 * Forty-four options behind a bare <select> is a scroll-and-hunt, and the
 * option text is just a name -- someone holding a 5 mg BPC-157 vial has no way
 * to search for it and no way to see the dose without picking it first.
 *
 * The native <select> stays in the DOM and stays the source of truth. It keeps
 * its id, its value, its optgroups and its change event, so restoreFromUrl,
 * readInputs and every existing test go on reading exactly what they read
 * before. This is a presentation layer over it: visually hidden but still
 * focusable-by-script, and if this module throws or never loads, the select is
 * simply visible and the page works as it always did.
 *
 * @module combobox
 */

const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Score a record against a query. Higher is better; 0 means no match.
 *
 * Punctuation is stripped on both sides because the catalogue is full of it:
 * someone typing "cjc1295" should find "CJC-1295 NO DAC", and "tb500" should
 * find "TB-500". A prefix match outranks a match in the middle so that typing
 * "bpc" puts BPC-157 above anything that merely mentions it.
 */
function score(query, haystacks) {
    const q = norm(query);
    if (!q) return 1;

    let best = 0;
    haystacks.forEach((text, i) => {
        const h = norm(text);
        if (!h) return;
        const at = h.indexOf(q);
        if (at === -1) return;
        // field weight (name beats category beats prose) minus how deep the hit is
        const weight = (haystacks.length - i) * 100;
        best = Math.max(best, weight + (at === 0 ? 50 : 0) - Math.min(at, 40));
    });
    return best;
}

function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Wrap the matched run in <mark>, on the escaped string. */
function highlight(label, query) {
    const q = norm(query);
    if (!q) return esc(label);

    // Walk the original string, tracking its normalised offset, so the
    // highlight lands on the right characters even though the match was made
    // against a string with the punctuation removed.
    let normIdx = 0, start = -1, end = -1;
    const map = [];
    for (let i = 0; i < label.length; i++) {
        if (/[a-z0-9]/i.test(label[i])) { map[normIdx] = i; normIdx++; }
    }
    const at = norm(label).indexOf(q);
    if (at === -1 || map[at] === undefined) return esc(label);
    start = map[at];
    end = (map[at + q.length - 1] ?? start) + 1;

    return esc(label.slice(0, start)) + '<mark>' + esc(label.slice(start, end)) + '</mark>' + esc(label.slice(end));
}

/**
 * Upgrade a <select> into a searchable listbox.
 *
 * @param {HTMLSelectElement} select
 * @param {Object} opts
 * @param {Array<Object>} opts.records - peptide records, for the meta line
 * @param {string} [opts.placeholder]
 * @returns {{refresh: () => void}|null} null when the browser cannot support it
 */
export function enhanceSelect(select, { records = [], placeholder = 'Search 44 peptides...' } = {}) {
    if (!select || !select.parentElement) return null;

    const byId = new Map(records.map(r => [r.id, r]));

    // Build the option model from the select itself rather than the records, so
    // whatever populatePeptideOptions decided to show is what gets searched.
    const options = [...select.querySelectorAll('option')]
        .filter(o => o.value)
        .map(o => ({
            value: o.value,
            label: o.textContent.trim(),
            group: o.parentElement.tagName === 'OPTGROUP' ? o.parentElement.label : '',
            record: byId.get(o.value) || null
        }));
    if (!options.length) return null;

    const wrap = document.createElement('div');
    wrap.className = 'combo';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'combo-input';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('autocomplete', 'off');
    input.id = `${select.id}-search`;
    input.placeholder = placeholder;

    const list = document.createElement('ul');
    list.className = 'combo-list';
    list.id = `${select.id}-listbox`;
    list.setAttribute('role', 'listbox');
    list.hidden = true;
    input.setAttribute('aria-controls', list.id);

    const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    caret.setAttribute('class', 'combo-caret');
    caret.setAttribute('viewBox', '0 0 16 16');
    caret.setAttribute('aria-hidden', 'true');
    caret.innerHTML = '<path fill="currentColor" d="M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>';

    // The label already points at the select by `for`; move it to the input so
    // clicking "Peptide" focuses the box a sighted user actually types into.
    const label = select.parentElement.querySelector(`label[for="${select.id}"]`);
    if (label) label.setAttribute('for', input.id);

    select.parentElement.insertBefore(wrap, select);
    wrap.append(input, caret, list);
    wrap.appendChild(select);

    // Visually hidden, not display:none -- a hidden-by-display select cannot be
    // focused, and losing focus() would break error handling that points at it.
    Object.assign(select.style, {
        position: 'absolute', width: '1px', height: '1px',
        overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)',
        whiteSpace: 'nowrap', border: '0', padding: '0', margin: '-1px'
    });
    select.setAttribute('tabindex', '-1');
    select.setAttribute('aria-hidden', 'true');

    let filtered = options;
    let active = -1;

    const metaFor = o => {
        const r = o.record;
        if (!r) return '';
        const dose = r.doseUnit === 'mcg' && r.med >= 1000
            ? `${r.med / 1000} mg`
            : `${r.med} ${r.doseUnit}`;
        return `${dose} · ${r.vialSize}${r.vialUnit} vial`;
    };

    function render(query) {
        filtered = options
            .map(o => ({ o, s: score(query, [o.label, o.group, o.record ? o.record.category : '']) }))
            .filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s || a.o.label.localeCompare(b.o.label))
            .map(x => x.o);

        if (!filtered.length) {
            list.innerHTML = `<li class="combo-empty">Nothing matches &ldquo;${esc(query)}&rdquo;</li>`;
            active = -1;
            return;
        }

        // Group headings only survive an unfiltered list; once someone is
        // searching, relevance order matters more than the taxonomy.
        const grouped = !query.trim();
        let html = '', lastGroup = null;
        filtered.forEach((o, i) => {
            if (grouped && o.group && o.group !== lastGroup) {
                html += `<li class="combo-group" role="presentation">${esc(o.group)}</li>`;
                lastGroup = o.group;
            }
            html += `<li class="combo-option" role="option" id="${list.id}-o${i}" data-i="${i}"`
                + ` aria-selected="${i === active}">`
                + `<span>${highlight(o.label, query)}</span>`
                + `<span class="combo-option-meta">${esc(metaFor(o))}</span></li>`;
        });
        list.innerHTML = html;
    }

    function open() {
        if (!list.hidden) return;
        list.hidden = false;
        input.setAttribute('aria-expanded', 'true');
    }

    function close() {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        active = -1;
    }

    function setActive(i) {
        const items = [...list.querySelectorAll('.combo-option')];
        if (!items.length) return;
        active = (i + items.length) % items.length;
        items.forEach((el, n) => el.setAttribute('aria-selected', String(n === active)));
        const el = items[active];
        input.setAttribute('aria-activedescendant', el.id);
        el.scrollIntoView({ block: 'nearest' });
    }

    function choose(i) {
        const o = filtered[i];
        if (!o) return;
        select.value = o.value;
        input.value = o.label;
        // The select is still the source of truth, so tell everything that
        // listens to it -- main.js wires its change handler to the select, not
        // to this input.
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
    }

    input.addEventListener('focus', () => { render(''); input.select(); open(); });
    input.addEventListener('input', () => { render(input.value); open(); setActive(0); });
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); open(); setActive(active + 1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); open(); setActive(active - 1); }
        else if (e.key === 'Enter') {
            if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); }
        } else if (e.key === 'Escape') { close(); }
        else if (e.key === 'Tab') { close(); }
    });
    list.addEventListener('mousedown', e => {
        // mousedown, not click: blur fires first on click and closes the list
        // before the selection lands.
        const li = e.target.closest('.combo-option');
        if (!li) return;
        e.preventDefault();
        choose(Number(li.dataset.i));
    });
    input.addEventListener('blur', () => setTimeout(close, 0));
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) close(); });

    /** Re-sync the visible text after something else sets select.value. */
    function refresh() {
        const chosen = options.find(o => o.value === select.value);
        input.value = chosen ? chosen.label : '';
    }
    select.addEventListener('change', refresh);
    refresh();

    return { refresh };
}
