// GEOPULSE SEARCH MODULE — V2.41
// Smart sidebar search engine for tours and layers
// Extracted from main.js for modularization
(function initSidebarSearch() {
    'use strict';

    const searchInput = document.getElementById('sidebar-search');
    const searchResults = document.getElementById('search-results');
    const searchClear = document.getElementById('search-clear');
    const searchKbd = document.querySelector('.search-kbd');
    if (!searchInput || !searchResults) return;

    // --- Build search index from DOM ---
    const SEARCH_INDEX = [];

    // Tours: extract from tour buttons
    document.querySelectorAll('.tour-btn[data-tour]').forEach(btn => {
        const tourId = btn.getAttribute('data-tour');
        const i18nKey = btn.querySelector('[data-i18n]');
        const cat = btn.closest('.tour-category[data-cat]');
        const catName = cat ? cat.getAttribute('data-cat') : 'featured';
        // Get icon from button text (first emoji)
        const iconMatch = btn.textContent.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/u);
        const icon = iconMatch ? iconMatch[0] : '🎯';
        // Get text from i18n dictionaries
        const enText = i18nKey ? (window._i18n?.en?.[i18nKey.getAttribute('data-i18n')] || i18nKey.textContent) : btn.textContent;
        const deText = i18nKey ? (window._i18n?.de?.[i18nKey.getAttribute('data-i18n')] || '') : '';

        SEARCH_INDEX.push({
            type: 'tour',
            id: tourId,
            icon: icon,
            name_en: enText.trim(),
            name_de: deText.trim(),
            cat: catName,
            el: btn
        });
    });

    // Layers: extract from toggle checkboxes
    document.querySelectorAll('.control-item .toggle-switch input[id^="toggle-"]').forEach(toggle => {
        const layerId = toggle.id.replace('toggle-', '');
        if (layerId === 'all' || layerId === 'ticker') return; // skip system toggles
        const controlItem = toggle.closest('.control-item');
        if (!controlItem) return;
        const labelSpan = controlItem.querySelector('.layer-info [data-i18n]');
        const iconMatch = controlItem.textContent.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/u);
        const icon = iconMatch ? iconMatch[0] : '🗺️';
        const enText = labelSpan ? (window._i18n?.en?.[labelSpan.getAttribute('data-i18n')] || labelSpan.textContent) : layerId;
        const deText = labelSpan ? (window._i18n?.de?.[labelSpan.getAttribute('data-i18n')] || '') : '';
        // Also grab description for better matching
        const descSpan = controlItem.querySelector('.layer-desc[data-i18n]');
        const descEn = descSpan ? (window._i18n?.en?.[descSpan.getAttribute('data-i18n')] || descSpan.textContent) : '';
        const descDe = descSpan ? (window._i18n?.de?.[descSpan.getAttribute('data-i18n')] || '') : '';

        SEARCH_INDEX.push({
            type: 'layer',
            id: layerId,
            icon: icon,
            name_en: enText.trim(),
            name_de: deText.trim(),
            desc_en: descEn.trim(),
            desc_de: descDe.trim(),
            toggleId: toggle.id,
            el: toggle
        });
    });

    // Build a flat text version for each item
    SEARCH_INDEX.forEach(item => {
        item._searchText = [
            item.name_en, item.name_de,
            item.desc_en || '', item.desc_de || '',
            item.id, item.cat || ''
        ].join(' ').toLowerCase();
    });

    console.log(`[GEOPULSE] Search index built: ${SEARCH_INDEX.length} items (tours + layers)`);

    // --- Cameras (V2.6) ---------------------------------------------------
    // Knapp 5.000 Verkehrskameras gehören in die Suche, aber nicht in den
    // ersten Seitenaufruf. Der Index wird geholt, sobald jemand wirklich tippt
    // — und dann genau einmal. Wer nie sucht, lädt ihn nie.
    //
    // Bewusst NICHT als Layer-Eintrag: Kameras sind Orte, keine Schalter. Man
    // sucht "Old Street", nicht "Webcams".
    let camerasRequested = false;

    function requestCameraIndex() {
        if (camerasRequested || !window.geopulseCameras) return;
        camerasRequested = true;
        window.geopulseCameras.ensureIndex().catch(() => { /* Suche läuft ohne weiter */ });
    }

    document.addEventListener('geopulse:cameras-ready', (ev) => {
        const cams = ev.detail?.cameras;
        if (!cams) return;
        for (const c of cams) {
            const name = c[4];
            SEARCH_INDEX.push({
                type: 'camera',
                id: window.geopulseCameras.key(c),
                icon: '📷',
                name_en: name,
                name_de: name,            // Straßennamen werden nicht übersetzt
                _searchText: name.toLowerCase(),
            });
        }
        console.log(`[GEOPULSE] Search index extended: +${cams.length} cameras`);
        // Läuft gerade eine Suche, sofort nachziehen — sonst wirkt es kaputt,
        // wenn Treffer erst beim nächsten Tastendruck auftauchen.
        if (searchInput.value.length >= 2) renderResults(searchInput.value);
    });

    // --- Fuzzy match ---
    function fuzzyMatch(query, item) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        return words.every(w => item._searchText.includes(w));
    }

    // --- Render results ---
    let activeIndex = -1;

    function renderResults(query) {
        if (!query || query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        const matches = SEARCH_INDEX.filter(item => fuzzyMatch(query, item));
        activeIndex = -1;

        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            searchResults.style.display = 'block';
            return;
        }

        // Group by type
        const tours = matches.filter(m => m.type === 'tour');
        const layers = matches.filter(m => m.type === 'layer');
        // Kameras zuletzt und gedeckelt: "Blvd" trifft in Austin hundertfach,
        // und eine Trefferliste, die man scrollen muss, ist keine Antwort.
        const CAMERA_RESULT_LIMIT = 8;
        const camerasAll = matches.filter(m => m.type === 'camera');
        const cameras = camerasAll.slice(0, CAMERA_RESULT_LIMIT);
        const lang = document.documentElement.lang === 'de' ? 'de' : 'en';

        let html = '';
        if (tours.length > 0) {
            html += '<div class="search-group-label">Tours</div>';
            tours.forEach((item, i) => {
                const name = lang === 'de' && item.name_de ? item.name_de : item.name_en;
                html += `<div class="search-result-item" data-type="tour" data-id="${item.id}" data-idx="${i}">
                    <span class="sr-icon">${item.icon}</span>
                    <span class="sr-name">${highlightMatch(name, query)}</span>
                    <span class="sr-type">tour</span>
                </div>`;
            });
        }
        if (layers.length > 0) {
            html += '<div class="search-group-label">Layers</div>';
            layers.forEach((item, i) => {
                const name = lang === 'de' && item.name_de ? item.name_de : item.name_en;
                html += `<div class="search-result-item" data-type="layer" data-id="${item.id}" data-idx="${tours.length + i}">
                    <span class="sr-icon">${item.icon}</span>
                    <span class="sr-name">${highlightMatch(name, query)}</span>
                    <span class="sr-type">layer</span>
                </div>`;
            });
        }

        if (cameras.length > 0) {
            const more = camerasAll.length - cameras.length;
            const label = lang === 'de' ? 'Kameras' : 'Cameras';
            html += `<div class="search-group-label">${label}${more > 0 ? ` <span style="opacity:.45;">(${cameras.length}/${camerasAll.length})</span>` : ''}</div>`;
            cameras.forEach((item, i) => {
                html += `<div class="search-result-item" data-type="camera" data-id="${escapeHtml(item.id)}" data-idx="${tours.length + layers.length + i}">
                    <span class="sr-icon">${item.icon}</span>
                    <span class="sr-name">${highlightMatch(item.name_en, query)}</span>
                    <span class="sr-type">cam</span>
                </div>`;
            });
            if (more > 0) {
                const hint = lang === 'de'
                    ? `${more} weitere — Suche verfeinern`
                    : `${more} more — refine your search`;
                html += `<div class="search-no-results" style="opacity:.5;">${hint}</div>`;
            }
        }

        searchResults.innerHTML = html;
        searchResults.style.display = 'block';

        // Click handler for results
        searchResults.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => activateResult(el));
        });
    }

    function highlightMatch(text, query) {
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1);
        let result = escapeHtml(text);
        words.forEach(w => {
            const regex = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
            result = result.replace(regex, '<span class="sr-highlight">$1</span>');
        });
        return result;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Activate a result ---
    function activateResult(el) {
        const type = el.getAttribute('data-type');
        const id = el.getAttribute('data-id');

        if (type === 'tour') {
            // Find and click the tour button
            const btn = document.querySelector(`.tour-btn[data-tour="${id}"]`);
            if (btn) {
                // Open parent category if closed
                const cat = btn.closest('.tour-category');
                if (cat && !cat.classList.contains('open')) {
                    cat.classList.add('open');
                }
                // Open tours section if collapsed
                const sec = document.getElementById('sec-tours');
                if (sec && !sec.classList.contains('open')) {
                    sec.classList.add('open');
                }
                btn.click();
            }
        } else if (type === 'camera') {
            // Schaltet den Layer bei Bedarf ein, fliegt hin und öffnet das Bild.
            window.geopulseCameras?.focus(id);
        } else if (type === 'layer') {
            // Find and toggle the layer checkbox
            const toggle = document.getElementById('toggle-' + id);
            if (toggle) {
                toggle.checked = !toggle.checked;
                toggle.dispatchEvent(new Event('change', { bubbles: true }));
                // Open the parent section
                const sec = toggle.closest('.collapsible-section');
                if (sec && !sec.classList.contains('open')) {
                    sec.classList.add('open');
                }
            }
        }

        // Clear search
        searchInput.value = '';
        searchResults.style.display = 'none';
        searchClear.style.display = 'none';
        searchKbd.style.display = '';
    }

    // --- Input handler ---
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.trim();
        searchClear.style.display = q ? 'block' : 'none';
        searchKbd.style.display = q ? 'none' : '';
        // Erst ab zwei Zeichen: ein versehentlicher Tastendruck soll den Index
        // nicht holen. Ab hier sucht jemand wirklich.
        if (q.length >= 2) requestCameraIndex();
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => renderResults(q), 120);
    });

    // --- Clear button ---
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchResults.style.display = 'none';
        searchClear.style.display = 'none';
        searchKbd.style.display = '';
        searchInput.focus();
    });

    // --- Keyboard navigation ---
    searchInput.addEventListener('keydown', (e) => {
        const items = searchResults.querySelectorAll('.search-result-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = Math.min(activeIndex + 1, items.length - 1);
            items.forEach(el => el.classList.remove('active'));
            items[activeIndex].classList.add('active');
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = Math.max(activeIndex - 1, 0);
            items.forEach(el => el.classList.remove('active'));
            items[activeIndex].classList.add('active');
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            activateResult(items[activeIndex]);
        } else if (e.key === 'Escape') {
            searchInput.value = '';
            searchResults.style.display = 'none';
            searchClear.style.display = 'none';
            searchKbd.style.display = '';
            searchInput.blur();
        }
    });

    // --- Ctrl+K global shortcut ---
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            // Open sidebar if closed
            const sidebar = document.getElementById('sidebar');
            if (sidebar && !sidebar.classList.contains('open')) {
                sidebar.classList.add('open');
            }
            searchInput.focus();
            searchInput.select();
        }
    });

    // --- Close results on outside click ---
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#sec-search')) {
            searchResults.style.display = 'none';
        }
    });

})();
