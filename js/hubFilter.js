/**
 * Type-ahead over the directory.
 *
 * The hub listed 44 records in seven tables down a 3,900px page with no way to
 * get to one except scrolling and reading. A directory whose only affordance is
 * scrolling is a list, not a directory.
 *
 * Progressive enhancement on purpose: the tables are static HTML built at build
 * time and every row is a real link. With this script missing, blocked or
 * broken, the page is exactly what it was - which is why the input is created
 * here rather than shipped in the markup. Nothing offers a control that cannot
 * work.
 */

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function build() {
    const main = document.querySelector('main.container');
    const intro = main && main.querySelector('.intro');
    const sections = [...document.querySelectorAll('main.container section.card')];
    const rows = [...document.querySelectorAll('main.container tbody tr')];
    if (!intro || !rows.length) return;

    // Index once. Row text covers name, dose, draw and frequency, so "weekly"
    // and "30 units" find things too, not only names.
    const index = rows.map(tr => {
        const section = tr.closest('section.card');
        const heading = section && section.querySelector('h2');
        return { tr, section, hay: norm(`${tr.textContent} ${heading ? heading.textContent : ''}`) };
    });

    const wrap = document.createElement('div');
    wrap.className = 'hub-filter';
    wrap.innerHTML = `
        <label class="hub-filter-label" for="hubFilter">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <span class="sr-only">Filter peptides</span>
        </label>
        <input id="hubFilter" type="search" autocomplete="off" spellcheck="false"
               placeholder="Filter ${rows.length} peptides - name, frequency, units...">
        <p class="hub-filter-count" role="status" aria-live="polite"></p>
        <p class="hub-filter-empty" hidden>Nothing matches that. <button type="button" class="hub-filter-clear">Clear the filter</button></p>`;
    intro.insertAdjacentElement('afterend', wrap);

    const input = wrap.querySelector('#hubFilter');
    const count = wrap.querySelector('.hub-filter-count');
    const empty = wrap.querySelector('.hub-filter-empty');

    function apply() {
        const q = norm(input.value);
        // Every space-separated word has to appear somewhere in the row, so
        // "bpc weekly" narrows rather than widening the way an OR would.
        const words = q ? q.split(' ') : [];
        let shown = 0;

        for (const { tr, hay } of index) {
            const hit = words.every(w => hay.includes(w));
            tr.hidden = !hit;
            if (hit) shown++;
        }
        for (const s of sections) {
            s.hidden = ![...s.querySelectorAll('tbody tr')].some(tr => !tr.hidden);
        }

        count.textContent = words.length
            ? `${shown} of ${index.length} peptides`
            : '';
        empty.hidden = shown !== 0;
    }

    input.addEventListener('input', apply);
    input.addEventListener('keydown', e => {
        if (e.key === 'Escape') { input.value = ''; apply(); }
    });
    wrap.querySelector('.hub-filter-clear').addEventListener('click', () => {
        input.value = '';
        apply();
        input.focus();
    });
    apply();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
else build();
