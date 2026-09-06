// ── SPLASH SCREEN — fallback dismiss if gateway is missing ──
(function dismissSplash() {
    // If Enter Gateway exists, it controls splash timing (with audio)
    if (document.getElementById('enter-gateway')) return;
    const splashEl = document.getElementById('splash-screen');
    if (!splashEl) return;
    const dismiss = () => {
        splashEl.classList.add('dissolve');
        splashEl.addEventListener('transitionend', () => splashEl.remove(), { once: true });
        setTimeout(() => { if (splashEl.parentNode) splashEl.remove(); }, 2000);
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(dismiss, 4000));
    } else {
        setTimeout(dismiss, 4000);
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // CONSTANTS & STATE
    // ----------------------------------------------------
    // Security: HTML escape helper to prevent XSS from external API data
    const escHtml = (s) => { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; };
    // Allow only safe formatting tags for briefing content (strong, br, em, b, i)
    const safeHtml = (s) => { const str = String(s || ''); return str.replace(/<(?!\/?(strong|br|em|b|i)\s*\/?>)[^>]*>/gi, (m) => escHtml(m)); };
    const VERSION = window.GeopulseConfig?.VERSION || '1.4';

    // ── RELIABLE FETCH — timeout-safe wrapper for all external API calls ──
    window.reliableFetch = async (url, label, opts = {}) => {
        const timeout = opts.timeout || 10000;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal, ...opts });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            return { data, status: res.status };
        } catch (err) {
            clearTimeout(timer);
            console.warn(`[reliableFetch] ${label || url}: ${err.message}`);
            throw err;
        }
    };
    
    // Real visitor counter via CounterAPI.dev (persistent across all users)
    const COUNTER_OFFSET = 1247;
    (async () => {
        const sessionEl = document.getElementById('session-count');
        if (!sessionEl) return;
        try {
            const res = await fetch('https://api.counterapi.dev/v1/geopulse-rbdesign/visits/up');
            const data = await res.json();
            sessionEl.innerHTML = '<i class="fa-solid fa-eye" style="opacity:.6;margin-right:4px;"></i>' + ((data.count || 0) + COUNTER_OFFSET).toLocaleString() + ' VISITS';
        } catch (e) {
            // Fallback: localStorage counter if API unreachable
            let count = parseInt(localStorage.getItem('geopulseSessionCount') || String(COUNTER_OFFSET), 10);
            count++;
            localStorage.setItem('geopulseSessionCount', count);
            sessionEl.innerHTML = '<i class="fa-solid fa-eye" style="opacity:.6;margin-right:4px;"></i>' + count.toLocaleString() + ' VISITS';
        }
    })();

    // ── i18n: loaded from i18n.js module ──
    const i18n = window._i18n;
    let currentLang = window.getLanguage ? window.getLanguage() : (localStorage.getItem('geopulseLang') || 'en');
    const setLanguage = window.setLanguage;

    // Sync local currentLang + re-fetch ticker whenever language changes
    // Wrap window.setLanguage so we catch ALL language switch paths (lang-btn, welcome toggle, setLang event)
    const _origSetLanguage = window.setLanguage;
    window.setLanguage = function(lang) {
        if (_origSetLanguage) _origSetLanguage(lang);
        currentLang = lang;
        // Re-fetch ticker in new language after a short delay (fetchNewsTicker defined below)
        setTimeout(() => { if (typeof fetchNewsTicker === 'function') fetchNewsTicker(); }, 100);
    };
    // Also catch the setLang Custom Event (dispatched by welcome overlay inline handler)
    document.addEventListener('setLang', (e) => {
        if (e.detail) currentLang = e.detail;
    });

    const toggles = {
        terminator: false, fires: false, weather: false, borders: false,
        iss: false, starlink: false, earthquakes: false, webcams: false,
        nightlights: false, population: false, satellites: false, temperature: false,
        volcanoes: false, radiation: false, internet: false, power: false,
        cables: false, datacenters: false, nuclear: false, conflicts: false, regimes: false, blocs: false, aiAtlas: false, pipelines: false,
        aurora: false, fireballs: false
    };

    let _tourActive = false; // Guard: blocks all data refreshes during active tours

    let issMarker = null;
    let flightMarkers = [];
    let webcamMarkers = [];
    let powerMarkers = [];

    let terminatorInterval = null;
    let tacticalQueue = [];
    let tacticalProcessing = false;

    // ----------------------------------------------------
    // 2-MODE SYSTEM: EXPLORE, ANALYZE
    // ----------------------------------------------------
    const modeConfig = {
        EXPLORE: {
            autoActiveLayers: ['terminator'],
            uiState: { sidebarCollapsed: true },
            disablePolling: ['iss', 'earthquakes']
        },
        ANALYZE: {
            autoActiveLayers: ['cables', 'blocs'],
            uiState: { sidebarCollapsed: false },
            disablePolling: []
        }
    };

    // ----------------------------------------------------
    // PREDEFINED THREAT SCENARIOS
    // ----------------------------------------------------
    const SCENARIOS = {
        europe: {
            layers: ['power', 'datacenters', 'temperature', 'weather', 'nuclear', 'blocs'],
            title: "Europe Energy Stress",
            what: "Extreme weather events combined with geopolitical tensions lead to severe strain on the European power grid.",
            why: "Data centers face brownouts, and nuclear output is being heavily monitored to prevent cascading grid failures across the continent.",
            center: [10.0, 50.0],
            zoom: 3.5,
            severity: "HIGH"
        },
        taiwan: {
            layers: ['cables', 'conflicts', 'regimes', 'nukes'],
            title: "Taiwan Escalation",
            what: "A sudden military mobilization in the Taiwan Strait disrupts global commercial shipping and reroutes international flights.",
            why: "Strategic undersea internet cables are flagged at high risk, and regional tension escalates to DEFCON alert levels.",
            center: [120.9, 23.7],
            zoom: 5.0,
            severity: "CRITICAL"
        },
        redsea: {
            layers: ['conflicts', 'power', 'internet', 'regimes'],
            title: "Red Sea Crisis",
            what: "Asymmetric attacks and naval posturing in the Red Sea cause a massive rerouting of global shipping around the Cape of Good Hope.",
            why: "Critical energy transit is delayed, and regional IT infrastructure experiences anomalous outages.",
            center: [38.5, 19.5],
            zoom: 4.5,
            severity: "HIGH"
        },
        nuclear: {
            layers: ['nukes', 'radiation', 'conflicts', 'blocs', 'satellites'],
            title: "Global Nuclear Risk",
            what: "Following a breakdown in strategic arms control, early warning satellite networks detect heightened readiness at silo locations.",
            why: "Airborne command posts are active, and terrestrial radiation sensors are put on high alert. Defcon level raised.",
            center: [0.0, 40.0],
            zoom: 2.0,
            severity: "CRITICAL"
        }
    };

    setTimeout(() => {
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const scenarioId = btn.dataset.scenario;
                const scenario = SCENARIOS[scenarioId];
                if(!scenario) return;

                // Turn off all layers first
                Object.keys(toggles).forEach(key => {
                    if (['ticker', 'all'].includes(key)) return;
                    const cb = document.getElementById(`toggle-${key}`);
                    if(cb && cb.checked) {
                        cb.checked = false;
                        cb.dispatchEvent(new Event('change'));
                    }
                });

                // Turn on specific scenario layers
                setTimeout(() => {
                    scenario.layers.forEach(layer => {
                        const cb = document.getElementById(`toggle-${layer}`);
                        if(cb && !cb.checked) {
                            cb.checked = true;
                            cb.dispatchEvent(new Event('change'));
                        }
                    });
                }, 100);

                // Map FlyTo
                map.flyTo({ center: scenario.center, zoom: scenario.zoom, pitch: 45, duration: 4000 });

                // Briefing
                if (window.openBriefing) {
                    window.openBriefing({
                        id: scenarioId,
                        title: scenario.title,
                        what: scenario.what,
                        why: scenario.why,
                        time: new Date().toLocaleTimeString('en-GB', {timeZone: 'UTC'}) + " ZULU",
                        source: "AI STRAT-LAYER",
                        severity: scenario.severity
                    });
                }
                
                if(window.setStatus) setStatus(currentLang === 'de' ? `SZENARIO GELADEN: ${scenario.title.toUpperCase()}` : `SCENARIO LOADED: ${scenario.title.toUpperCase()}`);
                
                // Fall back to ANALYZE mode automatically for full dashboard visibility
                if (switchMode && currentMode !== 'ANALYZE') switchMode('ANALYZE');
            });
        });

        document.getElementById('clear-scenarios')?.addEventListener('click', () => {
            Object.keys(toggles).forEach(key => {
                if (['ticker', 'all'].includes(key)) return;
                const cb = document.getElementById(`toggle-${key}`);
                if(cb && cb.checked) {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change'));
                }
            });
            if(window.closeBriefing) window.closeBriefing();
            map.flyTo({ center: [15.0, 48.0], zoom: 2.2, pitch: 0, duration: 3000 });
            if(window.setStatus) setStatus(currentLang === 'de' ? 'ALLE EBENEN ZURÜCKGESETZT' : 'ALL LAYERS RESET');
        });

        // ── MAP VIEW RESET — reset pitch/bearing/zoom to default ──
        document.getElementById('reset-map-view')?.addEventListener('click', () => {
            map.flyTo({ center: [15.0, 48.0], zoom: 2.2, pitch: 0, bearing: 0, duration: 2000 });
            if(window.setStatus) setStatus(currentLang === 'de' ? 'KARTENANSICHT ZURÜCKGESETZT' : 'MAP VIEW RESET');
        });
    }, 500);

    const switchMode = (modeId) => {
        // Mode switching logic removed in V8.8
    };

    const handleManualLayerToggle = () => {
        // Manual override logic removed in V8.8
    };

    // Attach click listener to checkboxes to detect manual override
    document.querySelectorAll('.control-item input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('click', () => {
            if (['toggle-ticker', 'toggle-all'].includes(cb.id)) return;
            handleManualLayerToggle();
        });
    });


    // ----------------------------------------------------
    // INTELLIGENCE BRIEFING PANEL
    // ----------------------------------------------------
    let currentBriefing = null;
    window.closeBriefing = () => {
        currentBriefing = null;
        const panel = document.getElementById('briefing-panel');
        if(panel) panel.classList.add('hidden');
    };

    window.openBriefing = (eventData) => {
        currentBriefing = eventData.id;
        const panel = document.getElementById('briefing-panel');
        if(!panel) return;
        panel.classList.remove('hidden');

        if (eventData.location) {
            map.flyTo({ center: eventData.location, zoom: 5, essential: true });
        }

        const relatedHtml = eventData.relatedLayers ? eventData.relatedLayers.map(layer => {
            return `<button class="related-chip" onclick="document.getElementById('toggle-${escHtml(layer.layerId)}').click()">+ ${escHtml(layer.label)}</button>`;
        }).join('') : '';

        panel.innerHTML = `
            <div class="briefing-header severity-${escHtml((eventData.severity || 'low').toLowerCase())}">
                <h2>${escHtml(eventData.title)}</h2>
                <button class="btn-close-briefing" onclick="closeBriefing()">✖</button>
            </div>
            <div class="briefing-body">
                <h3>SITUATION</h3>
                <p>${safeHtml(eventData.what || '')}</p>
                <h3>ASSESSMENT</h3>
                <p>${safeHtml(eventData.why || '')}</p>
                
                <div class="briefing-meta-grid">
                    <div><span>TIME DETECTED</span>${escHtml(eventData.time)}</div>
                    <div><span>SOURCE / FEED</span>${escHtml(eventData.source)}</div>
                </div>
                
                ${relatedHtml ? `<h3>RELATED SIGNALS</h3><div class="related-chips">${relatedHtml}</div>` : ''}
            </div>
        `;
    };


    // ----------------------------------------------------
    // LAYER STATUS MANAGEMENT (V8.7)
    // ----------------------------------------------------
    // Non-destructive layer status tracking — preserves all sidebar HTML
    const updateLayerStatus = (id, status, infoMsg = "") => {
        const meta = window.GeopulseConfig.LAYER_METADATA?.[id];
        if (!meta) return;
        meta.status = status;
        meta.lastUpdate = Date.now();
        if (status === 'ERROR') console.warn(`[LAYER] ${id}: ${infoMsg}`);
    };

    // Set dataset attributes for styling hooks — does NOT replace DOM
    document.querySelectorAll('.control-item').forEach(item => {
        const toggle = item.querySelector('input[type="checkbox"]');
        if (toggle && toggle.id.startsWith('toggle-')) {
            const id = toggle.id.replace('toggle-', '');
            if (window.GeopulseConfig.LAYER_METADATA?.[id]) item.dataset.layerId = id;
        }
    });

    // ----------------------------------------------------
    const statusText = document.getElementById("status-text");
    const setStatus = (msg) => { if(statusText) statusText.innerText = msg; };
    window.setStatus = setStatus;
    const sidebar = document.getElementById('sidebar');
    const infoPanel = document.getElementById('info-panel');
    // Reset scroll on collapse so header is always visible in collapsed state
    [infoPanel, document.getElementById('quiz-hud'), document.getElementById('tours-hud')].forEach(el => {
        if (el) el.addEventListener('mouseleave', () => { setTimeout(() => { el.scrollTop = 0; }, 450); });
    });
    let activeMobilePanel = null;
    // Fully close the TOURS overlay (clears the inline styles set when it was opened)
    // and collapse the QUIZ panel, so no two floating panels overlap on mobile.
    const closeFloatingHuds = () => {
        const toursHud = document.getElementById('tours-hud');
        if (toursHud) {
            toursHud.classList.remove('touch-open');
            ['display','position','top','left','right','width','maxHeight','borderRadius','zIndex','overflowY']
                .forEach(p => { toursHud.style[p] = ''; });
        }
        document.getElementById('quiz-hud')?.classList.remove('touch-open');
    };
    const switchSection = (target) => {
        if(window.innerWidth > 768) return;
        if (activeMobilePanel === target && target !== 'map') {
            sidebar.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            closeFloatingHuds();
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            const scopeBtn = document.querySelector('.nav-btn[data-target="map"]');
            if (scopeBtn) scopeBtn.classList.add('active');
            return;
        }
        sidebar.classList.remove('active');
        if (infoPanel) infoPanel.classList.remove('active');
        closeFloatingHuds();
        document.body.classList.remove('mobile-panel-open');
        activeMobilePanel = null;
        if(target === 'layers') {
            sidebar.classList.add('active');
            document.body.classList.add('mobile-panel-open');
            activeMobilePanel = 'layers';
            const fs = sidebar.querySelector('.collapsible-section:not(.open)');
            if (fs && !sidebar.querySelector('.collapsible-section.open')) fs.classList.add('open');
        }
        if(target === 'tours') {
            // On mobile, toggle tours-hud as overlay
            const toursHud = document.getElementById('tours-hud');
            if (toursHud) {
                toursHud.classList.toggle('touch-open');
                toursHud.style.display = 'block';
                toursHud.style.position = 'fixed';
                toursHud.style.top = '28px';
                toursHud.style.left = '0';
                toursHud.style.right = '0';
                toursHud.style.width = '100%';
                toursHud.style.maxHeight = '85vh';
                toursHud.style.borderRadius = '0';
                toursHud.style.zIndex = '950';
                toursHud.style.overflowY = 'auto';
            }
            document.body.classList.add('mobile-panel-open');
            activeMobilePanel = 'tours';
        }

        if(target === 'info') {
            if (infoPanel) infoPanel.classList.add('active');
            document.body.classList.add('mobile-panel-open');
            activeMobilePanel = 'info';
        }
        document.querySelectorAll('.nav-btn').forEach(b => {
            const t = b.dataset.target || (b.id === 'mobile-layers-btn' ? 'layers' : '');
            b.classList.toggle('active', t === target);
        });
    };
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            switchSection(btn.dataset.target || (btn.id === 'mobile-layers-btn' ? 'layers' : ''));
        });
    });
    const handleOrientation = () => {
        if (window.innerWidth > window.innerHeight && window.innerWidth <= 1024) {
            sidebar.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
        }
    };
    window.addEventListener('resize', handleOrientation);
    window.addEventListener('orientationchange', handleOrientation);
    document.querySelectorAll('.cat-toggle').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const section = btn.closest('.collapsible-section');
            if (section) section.classList.toggle('open');
        });
    });
    // ── AUTO-COLLAPSE SIDEBAR ON TOGGLE (Mobile) ──
    // When user toggles a layer or clicks a scenario, close the sidebar
    // after a brief delay so they see the map change
    const autoCollapseMobile = () => {
        if (window.innerWidth > 768) return;
        setTimeout(() => {
            sidebar.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            const scopeBtn = document.querySelector('.nav-btn[data-target="map"]');
            if (scopeBtn) scopeBtn.classList.add('active');
        }, 400);
    };
    // Attach to all layer toggles
    sidebar.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', autoCollapseMobile);
    });
    // Attach to scenario buttons
    sidebar.querySelectorAll('.tactical-btn').forEach(btn => {
        btn.addEventListener('click', autoCollapseMobile);
    });
    // Attach to tour buttons
    sidebar.querySelectorAll('.tour-btn').forEach(btn => {
        btn.addEventListener('click', autoCollapseMobile);
    });
    // ── END MOBILE NAVIGATION SETUP ──

    // INITIALIZE V4 MAPLIBRE GL JS
    // ----------------------------------------------------
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
            sources: {
                'esri-satellite': {
                    type: 'raster',
                    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                    tileSize: 256, maxzoom: 15,
                    attribution: '&copy; Esri &mdash; NASA / USGS'
                }
            },
            layers: [{ id: 'base-map', type: 'raster', source: 'esri-satellite', minzoom: 0, maxzoom: 15 }]
        },
        center: [15.0, 48.0], zoom: 2.2, pitch: 0, bearing: 0,
        projection: { type: 'globe' }, 
        dragRotate: true, dragPan: true, scrollZoom: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

    // [Mobile nav code (switchSection, nav-btn listeners, handleOrientation, cat-toggle) 
    //  is registered BEFORE map init for resilience — see line ~424]

    // Close panels on map tap — requires the map object so stays here
    map.on('click', () => {
        if(window.innerWidth <= 768 && activeMobilePanel) {
            sidebar.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            const scopeBtn = document.querySelector('.nav-btn[data-target="map"]');
            if (scopeBtn) scopeBtn.classList.add('active');
        }
    });

    // ============================================================
    // MAP LOAD — Initialize All Data Layers
    // ============================================================
    map.on('load', async () => {
        setStatus(currentLang === 'de' ? 'KARTE GELADEN. DATENSTRÖME WERDEN INITIALISIERT...' : 'MAP LOADED. INITIALIZING DATA STREAMS...');

        // ═══════════════════════════════════════════════════════════
        // GEN Z VISUAL EFFECTS — Atmosphere, Particles, Sounds
        // ═══════════════════════════════════════════════════════════

        // ── 1. MAP ATMOSPHERE / SKY (3D depth at horizon) ──
        try {
            map.setSky({
                'sky-color': '#000a1a',
                'sky-horizon-blend': 0.4,
                'horizon-color': '#003366',
                'horizon-fog-blend': 0.6,
                'fog-color': '#001122',
                'fog-ground-blend': 0.1
            });
        } catch(e) { console.warn('[atmosphere] Sky not supported:', e.message); }

        // ── 2. AMBIENT PARTICLE FIELD (floating data-stream particles) ──
        try {
            const canvas = document.getElementById('particle-canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                let particles = [];
                const PARTICLE_COUNT = 50;
                const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
                resize();
                window.addEventListener('resize', resize);

                for (let i = 0; i < PARTICLE_COUNT; i++) {
                    particles.push({
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        vx: (Math.random() - 0.5) * 0.3,
                        vy: (Math.random() - 0.5) * 0.3,
                        r: Math.random() * 1.5 + 0.5,
                        a: Math.random() * 0.5 + 0.2,
                        hue: Math.random() > 0.7 ? 180 : (Math.random() > 0.5 ? 50 : 200)
                    });
                }

                function drawParticles() {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    // Draw connections between nearby particles
                    for (let i = 0; i < particles.length; i++) {
                        for (let j = i + 1; j < particles.length; j++) {
                            const dx = particles[i].x - particles[j].x;
                            const dy = particles[i].y - particles[j].y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist < 120) {
                                ctx.beginPath();
                                ctx.strokeStyle = `rgba(0,212,255,${0.08 * (1 - dist / 120)})`;
                                ctx.lineWidth = 0.5;
                                ctx.moveTo(particles[i].x, particles[i].y);
                                ctx.lineTo(particles[j].x, particles[j].y);
                                ctx.stroke();
                            }
                        }
                    }
                    // Draw particles
                    particles.forEach(p => {
                        p.x += p.vx;
                        p.y += p.vy;
                        if (p.x < 0) p.x = canvas.width;
                        if (p.x > canvas.width) p.x = 0;
                        if (p.y < 0) p.y = canvas.height;
                        if (p.y > canvas.height) p.y = 0;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                        ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.a})`;
                        ctx.fill();
                    });
                    requestAnimationFrame(drawParticles);
                }
                drawParticles();
            }
        } catch(e) { console.warn('[particles] Init failed:', e.message); }

        // -- 3. PROCEDURAL SOUND EFFECTS ENGINE --
        // Extracted to audio.js module (loaded before main.js)
        // Exposes: window._geoSfx with .tick(), .whoosh(), .chime()

        // ── PLACE LABELS OVERLAY (Esri — transparent city/country names) ──
        // Adds city, country, and place names on top of satellite imagery
        // so users can orient themselves during tours and exploration.
        try {
            map.addSource('esri-labels', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                attribution: 'Labels © Esri'
            });
            map.addLayer({
                id: 'esri-labels-layer',
                type: 'raster',
                source: 'esri-labels',
                paint: { 'raster-opacity': 0.75 },
                layout: { visibility: 'visible' }
            });
        } catch (err) { console.warn('[labels] Esri reference overlay failed:', err); }

        // ── EARTHQUAKES (USGS — Live GeoJSON) ──────────────────
        try {
            const eqResult = await window.reliableFetch(
                'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson', 'earthquakes'
            );
            map.addSource('earthquakes-src', { type: 'geojson', data: eqResult.data });
            map.addLayer({
                id: 'earthquakes-ring', type: 'circle', source: 'earthquakes-src',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 10, 5, 22, 7, 40],
                    'circle-color': 'transparent',
                    'circle-stroke-color': ['interpolate', ['linear'], ['get', 'mag'], 2.5, '#ffb000', 5, '#ff6600', 7, '#ff0000'],
                    'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.35
                }
            });
            map.addLayer({
                id: 'earthquakes-core', type: 'circle', source: 'earthquakes-src',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 3, 5, 7, 7, 14],
                    'circle-color': ['interpolate', ['linear'], ['get', 'mag'], 2.5, '#ffb000', 5, '#ff6600', 7, '#ff0000'],
                    'circle-opacity': 0.85
                }
            });
            map.on('click', 'earthquakes-core', (e) => {
                const p = e.features[0].properties;
                const t = new Date(p.time).toLocaleString();
                new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(
                    `<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;"><h3 style="color:#ff6600;margin:0 0 5px;border-bottom:1px solid #ff660044;padding-bottom:4px;">🌍 ${currentLang==='de'?'SEISMISCHES EREIGNIS':'SEISMIC EVENT'}</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;"><div style="background:rgba(255,100,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">${currentLang==='de'?'STÄRKE':'MAGNITUDE'}</div><div style="color:#ff6600;font-size:1.1rem;font-weight:bold;">${escHtml(p.mag)}</div></div><div style="background:rgba(255,100,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">${currentLang==='de'?'TIEFE':'DEPTH'}</div><div>${escHtml(Math.round(e.features[0].geometry.coordinates[2]))} km</div></div></div><div style="font-size:.65rem;opacity:.75;line-height:1.4;">${escHtml(p.place)}</div><div style="font-size:.55rem;opacity:.3;margin-top:5px;">${escHtml(t)} — USGS</div></div>`
                ).addTo(map);
            });
            map.on('mouseenter', 'earthquakes-core', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'earthquakes-core', () => map.getCanvas().style.cursor = '');
            updateLayerStatus('earthquakes', 'LIVE', 'USGS Feed Online');

            // ── EARTHQUAKE PULSE RIPPLE (animated expanding rings) ──
            map.addLayer({
                id: 'earthquakes-pulse', type: 'circle', source: 'earthquakes-src',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 2.5, 18, 5, 35, 7, 55],
                    'circle-color': 'transparent',
                    'circle-stroke-color': ['interpolate', ['linear'], ['get', 'mag'], 2.5, '#ffb000', 5, '#ff6600', 7, '#ff0000'],
                    'circle-stroke-width': 1,
                    'circle-stroke-opacity': 0.15
                }
            });
            // Animate the pulse ring
            let eqPulsePhase = 0;
            setInterval(() => {
                if (!toggles.earthquakes) return;
                eqPulsePhase = (eqPulsePhase + 1) % 60;
                const scale = 1 + (eqPulsePhase / 60) * 1.5;
                const opacity = 0.3 * (1 - eqPulsePhase / 60);
                if (map.getLayer('earthquakes-pulse')) {
                    map.setPaintProperty('earthquakes-pulse', 'circle-stroke-opacity', opacity);
                    map.setPaintProperty('earthquakes-pulse', 'circle-radius',
                        ['interpolate', ['linear'], ['get', 'mag'], 2.5, 18 * scale, 5, 35 * scale, 7, 55 * scale]
                    );
                }
            }, 50);
        } catch(e) { console.warn('[EARTHQUAKES] Init failed:', e.message); }

        // ── WILDFIRES (NASA FIRMS — VIIRS satellite hotspots, lazy-loaded) ──
        // EONET (the previous source) only lists curated, US-centric *named* fire
        // events — Europe/global fires never appeared. FIRMS returns raw VIIRS
        // 375m thermal hotspots worldwide via its keyed CSV area API (CORS: *).
        // The world/1-day payload is ~5 MB, so we defer the fetch until the user
        // first switches the layer on (see toggle-fires handler).
        try {
            map.addSource('fires-src', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });
            map.addLayer({
                id: 'fires-layer', type: 'circle', source: 'fires-src',
                layout: { visibility: 'none' },
                paint: {
                    // small dots — at world zoom their density IS the wildfire signal
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 1.6, 5, 3, 8, 6, 11, 11],
                    'circle-color': ['case',
                        ['>', ['coalesce', ['get', 'frp'], 0], 100], '#ff2200',
                        ['>', ['coalesce', ['get', 'frp'], 0], 20], '#ff6600',
                        '#ffcc00'
                    ],
                    'circle-opacity': ['interpolate', ['linear'], ['zoom'], 2, 0.55, 8, 0.85],
                    'circle-stroke-color': '#ff3300',
                    'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 5, 0, 9, 0.4],
                    'circle-stroke-opacity': 0.4
                }
            });
            map.on('click', 'fires-layer', (e) => {
                const p = e.features[0].properties;
                const when = (p.date && p.time != null)
                    ? `${p.date} ${String(p.time).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')} UTC`
                    : (p.date || '');
                const frp = (p.frp != null && p.frp !== '') ? Number(p.frp).toFixed(1) : null;
                const confLabel = { h: currentLang==='de'?'hoch':'high', n: currentLang==='de'?'normal':'nominal', l: currentLang==='de'?'niedrig':'low' }[p.conf] || p.conf || '';
                const frpLine = frp
                    ? `<div style="background:rgba(255,85,0,.08);padding:3px 6px;margin-bottom:5px;"><div style="opacity:.5;font-size:.6rem;">${currentLang==='de'?'STRAHLUNGSLEISTUNG':'FIRE RADIATIVE POWER'}</div><div style="color:#ff6600;font-size:1.05rem;font-weight:bold;">${escHtml(frp)} MW</div></div>`
                    : '';
                new maplibregl.Popup({ maxWidth: '260px' }).setLngLat(e.lngLat).setHTML(
                    `<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;"><h3 style="color:#ff6600;margin:0 0 5px;border-bottom:1px solid #ff660044;padding-bottom:4px;">🔥 ${currentLang==='de'?'FEUER-HOTSPOT':'FIRE HOTSPOT'}</h3>${frpLine}<div style="font-size:.6rem;opacity:.75;line-height:1.5;">${currentLang==='de'?'Konfidenz':'Confidence'}: ${escHtml(confLabel)}<br>${currentLang==='de'?'Satellit':'Satellite'}: ${escHtml(p.sat || 'VIIRS')}</div><div style="font-size:.55rem;opacity:.3;margin-top:5px;">${escHtml(when)} — NASA FIRMS</div></div>`
                ).addTo(map);
            });
            map.on('mouseenter', 'fires-layer', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'fires-layer', () => map.getCanvas().style.cursor = '');

            // Lazy loader — fetched on first toggle-on, then cached in the source.
            window.__firesLoaded = false;
            window.__loadFires = async () => {
                if (window.__firesLoaded) return;
                window.__firesLoaded = true;              // guard re-entry
                updateLayerStatus('fires', 'LIVE', 'loading…');
                try {
                    const KEY = window.GeopulseConfig.FIRMS_MAP_KEY;
                    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${KEY}/VIIRS_SNPP_NRT/world/1`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const text = await res.text();
                    const lines = text.trim().split(/\r?\n/);
                    const cols = lines[0].split(',');
                    const ci = {}; cols.forEach((c, i) => ci[c] = i);
                    const features = [];
                    for (let i = 1; i < lines.length; i++) {
                        const c = lines[i].split(',');
                        const conf = c[ci.confidence];
                        if (conf === 'l') continue;         // drop low-confidence noise
                        const lon = +c[ci.longitude], lat = +c[ci.latitude];
                        if (isNaN(lon) || isNaN(lat)) continue;
                        features.push({
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [lon, lat] },
                            properties: {
                                frp: parseFloat(c[ci.frp]) || 0,
                                conf: conf,
                                sat: c[ci.satellite] || '',
                                date: c[ci.acq_date] || '',
                                time: c[ci.acq_time] || ''
                            }
                        });
                    }
                    const src = map.getSource('fires-src');
                    if (src) src.setData({ type: 'FeatureCollection', features });
                    updateLayerStatus('fires', 'LIVE', `${features.length} hotspots`);
                } catch (err) {
                    console.warn('[FIRES] FIRMS load failed:', err.message);
                    window.__firesLoaded = false;           // allow retry on next toggle
                    updateLayerStatus('fires', 'ERROR', 'FIRMS unreachable');
                }
            };
            updateLayerStatus('fires', 'STANDBY', 'tap to load');
        } catch(e) {
            console.warn('[FIRES] Init failed:', e.message);
            updateLayerStatus('fires', 'ERROR', 'init failed');
        }

        // ── SOLAR TERMINATOR (Calculated) ──────────────────────
        try {
            const calcTerminator = () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 0);
                const dayOfYear = Math.floor((now - start) / 86400000);
                const decl = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
                const declRad = decl * Math.PI / 180;
                const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
                const solarNoonLon = (12 - utcHours) * 15;
                const nightCoords = [];
                for (let lon = -180; lon <= 180; lon += 2) {
                    const ha = (lon - solarNoonLon) * Math.PI / 180;
                    const latRad = Math.atan(-Math.cos(ha) / Math.tan(declRad));
                    nightCoords.push([lon, latRad * 180 / Math.PI]);
                }
                if (decl > 0) { nightCoords.push([180, -90], [-180, -90]); }
                else { nightCoords.push([180, 90], [-180, 90]); }
                nightCoords.push(nightCoords[0]);
                return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [nightCoords] } };
            };
            map.addSource('terminator-src', { type: 'geojson', data: calcTerminator() });
            map.addLayer({ id: 'terminator-layer', type: 'fill', source: 'terminator-src', layout: { visibility: 'none' }, paint: { 'fill-color': '#000011', 'fill-opacity': 0.35 } });
            terminatorInterval = setInterval(() => { const s = map.getSource('terminator-src'); if(s) s.setData(calcTerminator()); }, 300000);
        } catch(e) { console.warn('[TERMINATOR] Init failed:', e.message); }

        // ── SHIPS layer removed — no free keyless AIS API available ──

        // ── FLIGHTS layer removed ──
        // The airplanes.live API only returns aircraft within 250 NM (~460 km) of a single
        // query point. At continental/world zoom the viewport spans thousands of km, so all
        // aircraft pile up in one dense blob around the query center — no amount of clustering
        // or styling can fix this fundamental API geometry mismatch. Removed to maintain the
        // app's visual quality. The ISS tracker remains as the primary orbital/aviation feature.

        // ── STARLINK (Simulated LEO Constellation — 500 sats) ──
        try {
            const slFeatures = [];
            for (let i = 0; i < 500; i++) {
                const ma = Math.random() * 360;
                const raan = Math.random() * 360;
                const lon = ((raan + ma) % 360) - 180;
                const lat = 53 * Math.sin(ma * Math.PI / 180) * (0.7 + Math.random() * 0.3);
                slFeatures.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, Math.max(-55, Math.min(55, lat))] } });
            }
            map.addSource('starlink-src', { type: 'geojson', data: { type: 'FeatureCollection', features: slFeatures } });
            map.addLayer({ id: 'starlink-layer', type: 'circle', source: 'starlink-src', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2, 5, 4, 10, 6], 'circle-color': '#ffffff', 'circle-opacity': 0.6, 'circle-blur': 0.4 } });

            // Click handler for Starlink satellites
            map.on('click', 'starlink-layer', (e) => {
                const coords = e.features[0].geometry.coordinates;
                new maplibregl.Popup({ offset: 6, maxWidth: '240px' })
                    .setLngLat(coords)
                    .setHTML(`<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                        <h3 style="color:#fff;margin:0 0 4px;font-size:.75rem;">🛰️ ${currentLang==='de'?'STARLINK-SATELLIT':'STARLINK SATELLITE'}</h3>
                        <div style="opacity:.5;font-size:.6rem;margin-bottom:4px;">${currentLang==='de'?'SpaceX LEO-Konstellation':'SpaceX LEO Constellation'}</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;">
                            <div style="background:rgba(255,255,255,.05);padding:3px;text-align:center;"><div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'UMLAUFBAHN':'ORBIT'}</div><div style="color:#00d4ff;">~550 km</div></div>
                            <div style="background:rgba(255,255,255,.05);padding:3px;text-align:center;"><div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'GESCHW.':'SPEED'}</div><div style="color:#00d4ff;">27.000 km/h</div></div>
                        </div>
                        <div style="opacity:.35;font-size:.5rem;margin-top:4px;letter-spacing:1px;">${currentLang==='de'?'SIMULIERTE POSITION · 5.500+ SATS IM ORBIT':'SIMULATED POSITION · 5,500+ SATS IN ORBIT'}</div>
                    </div>`)
                    .addTo(map);
            });
            map.on('mouseenter', 'starlink-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'starlink-layer', () => { map.getCanvas().style.cursor = ''; });
        } catch(e) { console.warn('[STARLINK] Init failed:', e.message); }

        // ── AURORA BOREALIS FORECAST (NOAA SWPC OVATION Model) ──────────
        try {
            map.addSource('aurora-src', {
                type: 'image',
                url: 'https://services.swpc.noaa.gov/images/aurora-forecast-northern-hemisphere.jpg',
                coordinates: [[-180, 90], [180, 90], [180, 0], [-180, 0]]
            });
            map.addLayer({
                id: 'aurora-layer', type: 'raster', source: 'aurora-src',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 0.55, 'raster-fade-duration': 500 }
            });
            // Also add southern hemisphere
            map.addSource('aurora-south-src', {
                type: 'image',
                url: 'https://services.swpc.noaa.gov/images/aurora-forecast-southern-hemisphere.jpg',
                coordinates: [[-180, 0], [180, 0], [180, -90], [-180, -90]]
            });
            map.addLayer({
                id: 'aurora-south-layer', type: 'raster', source: 'aurora-south-src',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 0.55, 'raster-fade-duration': 500 }
            });
            updateLayerStatus('aurora', 'LIVE', 'NOAA OVATION Model');
        } catch(e) { console.warn('[AURORA] Init failed:', e.message); }

        // ── METEOR / FIREBALL TRACKER (NASA CNEOS) ──────────────────────
        try {
            const fbResult = await window.reliableFetch(
                'https://ssd-api.jpl.nasa.gov/fireball.api?limit=150', 'fireballs'
            );
            const fbFields = fbResult.data?.fields || [];
            const fbData = fbResult.data?.data || [];
            const iDate = fbFields.indexOf('date');
            const iLat = fbFields.indexOf('lat');
            const iLatDir = fbFields.indexOf('lat-dir');
            const iLon = fbFields.indexOf('lon');
            const iLonDir = fbFields.indexOf('lon-dir');
            const iEnergy = fbFields.indexOf('energy');
            const iVel = fbFields.indexOf('vel');
            const iAlt = fbFields.indexOf('alt');
            const fbFeatures = fbData.filter(r => r[iLat] && r[iLon]).map(r => {
                const lat = parseFloat(r[iLat]) * (r[iLatDir] === 'S' ? -1 : 1);
                const lon = parseFloat(r[iLon]) * (r[iLonDir] === 'W' ? -1 : 1);
                const energy = parseFloat(r[iEnergy]) || 0.1;
                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [lon, lat] },
                    properties: {
                        date: r[iDate] || 'Unknown',
                        energy: energy,
                        vel: r[iVel] || '—',
                        alt: r[iAlt] || '—'
                    }
                };
            });
            map.addSource('fireballs-src', { type: 'geojson', data: { type: 'FeatureCollection', features: fbFeatures } });
            // Glow ring
            map.addLayer({
                id: 'fireballs-glow', type: 'circle', source: 'fireballs-src',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'energy'], 0.1, 12, 1, 20, 10, 35, 100, 55],
                    'circle-color': 'transparent',
                    'circle-stroke-color': '#ffaa33',
                    'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.3
                }
            });
            // Core dot
            map.addLayer({
                id: 'fireballs-core', type: 'circle', source: 'fireballs-src',
                layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'energy'], 0.1, 3, 1, 5, 10, 9, 100, 16],
                    'circle-color': ['interpolate', ['linear'], ['get', 'energy'], 0.1, '#ffcc66', 1, '#ff8800', 10, '#ff4400', 100, '#ff0000'],
                    'circle-opacity': 0.9,
                    'circle-blur': 0.3
                }
            });
            // Click popup
            map.on('click', 'fireballs-core', (e) => {
                const p = e.features[0].properties;
                const hiroshima = (p.energy / 15).toFixed(1);
                new maplibregl.Popup({ maxWidth: '280px' }).setLngLat(e.lngLat).setHTML(
                    `<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;"><h3 style="color:#ff8800;margin:0 0 5px;border-bottom:1px solid #ff880044;padding-bottom:4px;">☄️ ${currentLang==='de'?'FEUERBALL / BOLIDE':'FIREBALL / BOLIDE'}</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;"><div style="background:rgba(255,136,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">${currentLang==='de'?'ENERGIE':'ENERGY'}</div><div style="color:#ff8800;font-size:1rem;font-weight:bold;">${escHtml(p.energy)} kT</div></div><div style="background:rgba(255,136,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">${currentLang==='de'?'GESCHW.':'VELOCITY'}</div><div>${escHtml(p.vel)} km/s</div></div></div><div style="background:rgba(255,136,0,.08);padding:3px 6px;margin-bottom:4px;"><div style="opacity:.5;font-size:.6rem;">≈ HIROSHIMA</div><div style="color:#ff4400;">${hiroshima}× ${currentLang==='de'?'Hiroshima-Äquivalent':'Hiroshima equivalent'}</div></div><div style="font-size:.6rem;opacity:.5;">${escHtml(p.date)}</div><div style="font-size:.5rem;opacity:.3;margin-top:4px;">Source: NASA CNEOS</div></div>`
                ).addTo(map);
            });
            map.on('mouseenter', 'fireballs-core', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'fireballs-core', () => map.getCanvas().style.cursor = '');
            updateLayerStatus('fireballs', 'LIVE', `${fbFeatures.length} events`);
        } catch(e) { console.warn('[FIREBALLS] Init failed:', e.message); }

        // ── POPULATION DENSITY (NASA GIBS — GPW v4.11, 2020) ──────────────
        try {
            map.addSource('population-src', {
                type: 'raster',
                tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GPW_Population_Density_2020/default/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png'],
                tileSize: 256
            });
            map.addLayer({ id: 'population-layer', type: 'raster', source: 'population-src', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.55 } });

            // Metro city markers — shown when population layer is active
            const metroCities = [
                [139.69,35.68,'Tokyo','Japan','37.4M',1],
                [77.21,28.61,'Delhi','India','32.9M',2],
                [121.47,31.23,'Shanghai','China','29.2M',3],
                [113.26,23.13,'Guangzhou','China','27.0M',4],
                [-46.63,-23.55,'São Paulo','Brazil','22.4M',5],
                [72.88,19.08,'Mumbai','India','21.7M',6],
                [116.40,39.90,'Beijing','China','21.5M',7],
                [-99.13,19.43,'Mexico City','Mexico','21.8M',8],
                [-43.17,-22.91,'Rio de Janeiro','Brazil','13.6M',9],
                [31.24,30.04,'Cairo','Egypt','22.0M',10],
                [90.41,23.81,'Dhaka','Bangladesh','23.2M',11],
                [126.98,37.57,'Seoul','South Korea','21.8M',12],
                [-73.94,40.67,'New York','USA','18.8M',13],
                [135.50,34.69,'Osaka','Japan','19.1M',14],
                [100.50,13.75,'Bangkok','Thailand','17.6M',15],
                [67.01,24.86,'Karachi','Pakistan','17.1M',16],
                [-118.24,34.05,'Los Angeles','USA','12.5M',17],
                [28.98,41.01,'Istanbul','Turkey','16.0M',18],
                [-87.63,41.88,'Chicago','USA','8.9M',19],
                [106.85,-6.21,'Jakarta','Indonesia','35.4M',20],
                [37.62,55.75,'Moscow','Russia','12.6M',21],
                [-0.12,51.51,'London','UK','9.5M',22],
                [2.35,48.86,'Paris','France','11.1M',23],
                [13.40,52.52,'Berlin','Germany','3.7M',24],
                [-77.04,38.91,'Washington D.C.','USA','6.4M',25],
                [55.27,25.20,'Dubai','UAE','3.5M',26],
                [174.76,-36.85,'Auckland','New Zealand','1.7M',27],
                [151.21,-33.87,'Sydney','Australia','5.4M',28],
                [18.42,-33.93,'Cape Town','South Africa','4.7M',29],
                [-58.38,-34.60,'Buenos Aires','Argentina','15.4M',30]
            ];
            const metroFeatures = metroCities.map(c => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [c[0], c[1]] },
                properties: { city: c[2], country: c[3], pop: c[4], rank: c[5], popNum: parseFloat(c[4]) }
            }));
            map.addSource('metro-cities-src', { type: 'geojson', data: { type: 'FeatureCollection', features: metroFeatures } });
            map.addLayer({ id: 'metro-cities-layer', type: 'circle', source: 'metro-cities-src', layout: { visibility: 'none' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['get', 'popNum'], 1, 4, 10, 7, 20, 10, 35, 14],
                    'circle-color': '#ff6633',
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': '#ffffff',
                    'circle-stroke-opacity': 0.6
                }
            });
            map.addLayer({ id: 'metro-cities-label', type: 'symbol', source: 'metro-cities-src', layout: { visibility: 'none',
                'text-field': ['get', 'city'], 'text-size': 11, 'text-offset': [0, 1.4], 'text-anchor': 'top',
                'text-font': ['Open Sans Bold']
            }, paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.7)', 'text-halo-width': 1 } });
            map.on('click', 'metro-cities-layer', (e) => {
                const p = e.features[0].properties;
                const coords = e.features[0].geometry.coordinates;
                new maplibregl.Popup({ offset: 8, maxWidth: '240px' })
                    .setLngLat(coords)
                    .setHTML(`<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                        <h3 style="color:#ff6633;margin:0 0 5px;font-size:.8rem;border-bottom:1px solid rgba(255,102,51,0.3);padding-bottom:4px;">🏙️ ${escHtml(p.city)}</h3>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:4px;">
                            <div style="background:rgba(255,102,51,.08);padding:4px 6px;border-radius:2px;"><div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'LAND':'COUNTRY'}</div><div style="color:#ff6633;font-size:.65rem;">${escHtml(p.country)}</div></div>
                            <div style="background:rgba(255,102,51,.08);padding:4px 6px;border-radius:2px;"><div style="opacity:.4;font-size:.5rem;">RANK</div><div style="color:#ff6633;font-size:.65rem;">#${p.rank}</div></div>
                        </div>
                        <div style="background:rgba(255,102,51,.08);padding:4px 6px;border-radius:2px;text-align:center;">
                            <div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'METROPOLREGION':'METRO POPULATION'}</div>
                            <div style="color:#ff6633;font-size:1rem;font-weight:bold;">${escHtml(p.pop)}</div>
                        </div>
                        <div style="opacity:.3;font-size:.45rem;margin-top:5px;letter-spacing:1px;">${currentLang==='de'?'QUELLE: UN WORLD URBANIZATION PROSPECTS 2024':'SOURCE: UN WORLD URBANIZATION PROSPECTS 2024'}</div>
                    </div>`)
                    .addTo(map);
            });
            map.on('mouseenter', 'metro-cities-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'metro-cities-layer', () => { map.getCanvas().style.cursor = ''; });
        } catch(e) { console.warn('[POPULATION] Init failed:', e.message); }

        // ── ROMAN EMPIRE TERRITORY (Simplified GeoJSON — 117 AD peak) ──
        try {
            map.addSource('roman-empire-src', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: { name: 'Roman Empire (117 AD)' },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [-9.5, 37], [-9, 41], [-8.5, 43.5], [-1.5, 43.5], [3, 43], [-2, 51], [0, 53.5], [2, 55.5],
                            [5, 51], [8, 48.5], [10, 48], [13, 47], [16, 48], [19, 47.5], [22, 44.5], [25, 44],
                            [28, 44], [29, 41.5], [32, 41], [36, 40], [40, 38], [43, 37.5], [46, 37],
                            [44, 35], [41, 33], [36, 34], [36, 31.5], [34, 29], [32, 31],
                            [30, 31.5], [28, 31], [25, 24], [32, 22],
                            [25, 32], [20, 33], [15, 34], [10, 37], [10, 33], [8, 33],
                            [5, 36], [2, 36], [-1, 35.5], [-5, 35.5], [-6, 36], [-9.5, 37]
                        ]]
                    }
                }
            });
            map.addLayer({
                id: 'roman-empire-fill', type: 'fill', source: 'roman-empire-src',
                layout: { visibility: 'none' },
                paint: { 'fill-color': '#c0392b', 'fill-opacity': 0.18 }
            });
            map.addLayer({
                id: 'roman-empire-border', type: 'line', source: 'roman-empire-src',
                layout: { visibility: 'none' },
                paint: { 'line-color': '#e74c3c', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.6 }
            });
        } catch(e) { console.warn('[ROMAN EMPIRE] Init failed:', e.message); }

        setStatus(currentLang === 'de' ? 'ALLE DATENSTRÖME INITIALISIERT. SYSTEM BEREIT.' : 'ALL DATA STREAMS INITIALIZED. SYSTEM READY.');

        // Keep labels on top of all data layers
        const elevateLabels = () => {
            if (map.getLayer('esri-labels-layer')) map.moveLayer('esri-labels-layer');
            if (map.getLayer('country-labels')) map.moveLayer('country-labels');
        };
        elevateLabels();
        map.on('sourcedata', () => { try { elevateLabels(); } catch(e) {} });

        // Kick off periodic data fetches
        fetchNewsTicker();
        setInterval(fetchNewsTicker, 300000);
        fetchLaunches();
        setInterval(fetchLaunches, 600000);
        fetchSolarData();
        setInterval(fetchSolarData, 600000);
    });

    // ============================================================
    // NEWS TICKER — bilingual: BBC (EN) / DW World (DE)
    // ============================================================
    const TICKER_FEEDS = {
        en: 'https://feeds.bbci.co.uk/news/world/rss.xml',
        de: 'https://rss.dw.com/rdf/rss-de-all'
    };
    const fetchNewsTicker = async () => {
        try {
            const lang = window.getLanguage ? window.getLanguage() : currentLang;
            const feedUrl = TICKER_FEEDS[lang] || TICKER_FEEDS.en;
            const result = await window.reliableFetch(
                `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`, 'newsticker'
            );
            const items = result.data?.items || [];
            if (!items.length) return;
            const tickerText = items.map(i => `? ${i.title.toUpperCase()}`).join('    //    ');
            document.querySelectorAll('.ticker-content').forEach(el => el.textContent = tickerText);
        } catch(e) { console.warn('[TICKER] RSS fetch failed:', e.message); }
    };

    // ============================================================
    // SOLAR STORM INDEX — NOAA SWPC Kp Index
    // ============================================================
    const fetchSolarData = async () => {
        const hud = document.getElementById('solar-hud');
        if (!hud) return;
        try {
            const result = await window.reliableFetch(
                'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 'solar'
            );
            const rows = result.data || [];
            if (rows.length < 1) return;
            const latest = rows[rows.length - 1];
            // NOAA API returns objects: {time_tag, Kp, a_running, station_count}
            // Fallback to legacy array format if needed
            const kp = typeof latest === 'object' && !Array.isArray(latest)
                ? parseFloat(latest.Kp)
                : parseFloat(latest[1]);
            if (isNaN(kp)) return;
            const kpColor = kp >= 7 ? '#ff0000' : kp >= 5 ? '#ff6600' : kp >= 4 ? '#ffb000' : '#00ff88';
            const kpLabel = kp >= 7 ? 'EXTREME STORM' : kp >= 5 ? 'GEOMAGNETIC STORM' : kp >= 4 ? 'UNSETTLED' : 'QUIET';
            // Extract time from object or legacy array
            const timeRaw = typeof latest === 'object' && !Array.isArray(latest)
                ? (latest.time_tag || '')
                : (latest[0] || '');
            const timeStr = timeRaw.includes('T')
                ? timeRaw.split('T')[1]?.slice(0,5) || '--'
                : timeRaw.split(' ')[1]?.slice(0,5) || '--';
            hud.innerHTML = `
                <div class="solar-title">☀ SOLAR STORM INDEX</div>
                <div class="solar-grid">
                    <div class="solar-cell"><div class="solar-val" style="color:${kpColor}">${kp.toFixed(1)}</div><div class="solar-lbl">Kp INDEX</div></div>
                    <div class="solar-cell"><div class="solar-val" style="color:${kpColor}">${kpLabel.split(' ')[0]}</div><div class="solar-lbl">STATUS</div></div>
                    <div class="solar-cell"><div class="solar-val" style="color:#aaa">${escHtml(timeStr)}</div><div class="solar-lbl">UTC TIME</div></div>
                </div>
                <div class="solar-level" style="color:${kpColor}">${kpLabel}</div>
            `;
        } catch(e) { hud.innerHTML = '<div class="solar-title">☀ SOLAR STORM INDEX</div><div class="solar-loading">NOAA SWPC OFFLINE</div>'; }
    };

    // ============================================================
    // ROCKET LAUNCH TRACKER (Launch Library 2 — free, CORS-enabled)
    // ============================================================
    const launchFeed = document.getElementById('launch-feed');

    const getCountdown = (net) => {
        const diff = new Date(net) - new Date();
        if (diff < 0) return '<span style="color:#0f0;">LAUNCHED</span>';
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        if (d > 0) return `<span style="color:#ff6600;">T-${d}d ${h}h</span>`;
        if (h > 0) return `<span style="color:#ffb000;">T-${h}h ${m}m</span>`;
        return `<span style="color:#ff4400;animation:pulse-ring .8s infinite;">T-${m}m &#9654;</span>`;
    };

    const getAgencyIcon = (name = '') => {
        if (/spacex/i.test(name)) return '🚀';
        if (/nasa/i.test(name)) return '🛸';
        if (/esa|ariane/i.test(name)) return '';
        if (/roscosmos|russia/i.test(name)) return '🛸';
        if (/isro/i.test(name)) return '';
        if (/cnsa|china/i.test(name)) return '';
        if (/rocketlab/i.test(name)) return '🔬';
        return '🛰️';
    };

    const fetchLaunches = async () => {
        if (!launchFeed) return;
        try {
            const { data } = await window.reliableFetch('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&format=json', 'launches', { timeout: 8000, retries: 1 });
            const launches = data?.results || [];
            if (!launches.length) {
                launchFeed.innerHTML = '<span style="opacity:.5;">No upcoming data</span>';
                return;
            }
            launchFeed.innerHTML = launches.map(l => {
                const agency = l.launch_service_provider?.name || 'Unknown';
                const rocket = l.rocket?.configuration?.name || 'Unknown Rocket';
                const name = l.name?.split('|')[0]?.trim() || 'Classified';
                const icon = getAgencyIcon(agency);
                const countdown = getCountdown(l.net);
                const pad = l.pad?.location?.name || '';
                return `<div style="padding:4px 0;border-bottom:1px solid rgba(255,100,0,.15);font-size:.68rem;">
                    <div style="color:#ff9955;">${icon} ${escHtml(name.length > 28 ? name.slice(0,27)+'…' : name)}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:2px;">
                        <span style="opacity:.8;">${escHtml(rocket)}</span>
                        ${countdown}
                    </div>
                    ${pad ? `<div style="opacity:.5;font-size:.58rem;">${escHtml(pad)}</div>` : ''}
                </div>`;
            }).join('');
        } catch(e) {
            launchFeed.innerHTML = '<span style="opacity:.4;">Launch data offline</span>';
        }
    };

    // ============================================================
    // LAUNCH HUD — show on hover over menu trigger, hide on leave
    // ============================================================
    const launchHud = document.getElementById('launch-hud');
    const launchTrigger = document.getElementById('launch-tracker-trigger');
    let launchHudTimeout = null;

    const showLaunchHud = () => {
        clearTimeout(launchHudTimeout);
        if (launchHud) {
            launchHud.style.opacity = '1';
            launchHud.style.pointerEvents = 'all';
            launchHud.style.transform = 'translateX(0)';
        }
    };
    const hideLaunchHud = () => {
        // Small delay so user can move mouse into the HUD without it closing
        launchHudTimeout = setTimeout(() => {
            if (launchHud) {
                launchHud.style.opacity = '0';
                launchHud.style.pointerEvents = 'none';
                launchHud.style.transform = 'translateX(-8px)';
            }
        }, 180);
    };

    if (launchTrigger) {
        launchTrigger.addEventListener('mouseenter', showLaunchHud);
        launchTrigger.addEventListener('mouseleave', hideLaunchHud);
    }
    if (launchHud) {
        launchHud.addEventListener('mouseenter', showLaunchHud);
        launchHud.addEventListener('mouseleave', hideLaunchHud);
    }

    // ============================================================
    // REGIME MAP — Democracy vs Autocracy (Freedom House 2024)
    // ============================================================
    const regimeMarkers = [];
    const initRegimeMap = () => {
        // [lon, lat, country, regime, fh_score, note]
        // Regime: D=Free Democracy, H=Hybrid/Partly Free, A=Authoritarian
        const countries = [
            // DEMOCRACIES (Free)
            [-77.04,38.89,'USA','D',83,'Federal republic. Electoral democracy.'],
            [-3.44,55.38,'UK','D',93,'Parliamentary monarchy.'],
            [2.35,48.85,'France','D',90,'Republic. Strong institutions.'],
            [13.38,52.52,'Germany','D',94,'Federal parliamentary republic.'],
            [12.48,41.89,'Italy','D',89,'Parliamentary republic.'],
            [2.17,41.39,'Spain','D',90,'Constitutional monarchy.'],
            [4.89,52.37,'Netherlands','D',98,'Constitutional monarchy.'],
            [18.07,59.33,'Sweden','D',100,'Constitutional monarchy.'],
            [10.75,59.91,'Norway','D',100,'Constitutional monarchy.'],
            [12.57,55.68,'Denmark','D',97,'Constitutional monarchy.'],
            [24.94,60.17,'Finland','D',100,'Republic.'],
            [-8.61,41.56,'Portugal','D',97,'Republic.'],
            [23.72,37.98,'Greece','D',85,'Republic.'],
            [19.04,47.5,'Hungary','H',57,'Competitive authoritarian (Orbán).'],
            [21.01,52.23,'Poland','D',83,'Republic, liberalizing post-2024.'],
            [14.44,50.08,'Czech Republic','D',94,'Parliamentary republic.'],
            [17.11,48.15,'Slovakia','H',72,'Populist drift under Fico.'],
            [26.1,44.44,'Romania','D',84,'Republic.'],
            [23.32,42.7,'Bulgaria','H',75,'Structural corruption issues.'],
            [16.37,48.21,'Austria','D',93,'Federal republic.'],
            [7.45,46.96,'Switzerland','D',96,'Direct democracy.'],
            [4.34,50.85,'Belgium','D',96,'Federal monarchy.'],
            [6.13,49.61,'Luxembourg','D',98,'Constitutional monarchy.'],
            [-6.27,53.33,'Ireland','D',97,'Republic.'],
            [28.05,53.9,'Belarus','A',11,'Lukashenko dictatorship since 1994.'],
            [30.52,50.45,'Ukraine','H',61,'Wartime democracy.'],
            [44.83,41.69,'Georgia','H',60,'Hybrid, GD party backsliding 2024.'],
            [49.89,40.41,'Azerbaijan','A',14,'Aliyev family dynasty.'],
            [44.51,40.18,'Armenia','H',54,'Post-revolution fragile democracy.'],
            [27.56,53.9,'Lithuania','D',93,'Baltic republic.'],
            [24.11,56.95,'Latvia','D',90,'Baltic republic.'],
            [25.27,54.69,'Estonia','D',95,'Baltic republic.'],
            [21.44,41.99,'North Macedonia','H',71,'Reforms ongoing.'],
            [19.82,41.33,'Albania','H',68,'Reforms toward EU accession.'],
            [18.42,43.86,'Bosnia','H',54,'Fractured ethnic politics.'],
            [20.46,44.80,'Serbia','H',56,'Vučić populism, media pressure.'],
            [20.93,42.66,'Kosovo','H',69,'Young democracy.'],
            [19.25,42.44,'Montenegro','H',68,'Long-ruling DPS now in opposition.'],
            [-79.38,43.65,'Canada','D',99,'Federal parliamentary democracy.'],
            [151.21,-33.87,'Australia','D',97,'Federal parliamentary democracy.'],
            [174.78,-36.87,'New Zealand','D',99,'Parliamentary democracy.'],
            [139.69,35.69,'Japan','D',96,'Constitutional monarchy.'],
            [126.98,37.57,'South Korea','D',83,'Republic.'],
            [121.5,25.05,'Taiwan','D',94,'De facto democracy.'],
            [103.82,1.35,'Singapore','H',47,'Dominant party state (PAP).'],
            [100.52,13.75,'Thailand','H',36,'Military-monitored democracy.'],
            [-70.67,-33.45,'Chile','D',94,'Republic.'],
            [-58.4,-34.6,'Argentina','D',83,'Republic.'],
            [-43.18,-22.91,'Brazil','D',79,'Federal republic.'],
            [-77.04,38.89,'Colombia','D',67,'Republic, security challenges.'],
            [-66.86,10.49,'Venezuela','A',16,'Maduro autocracy.'],
            [-77.04,-12.04,'Peru','H',70,'Democratic dysfunction.'],
            [-47.93,-15.78,'Bolivia','H',66,'Partial backsliding.'],
            // HYBRID / PARTLY FREE
            [37.61,55.75,'Russia','A',16,'Putin autocracy.'],
            [32.85,39.93,'Turkey','H',34,'Erdoğan competitive authoritarian.'],
            [51.43,35.69,'Iran','A',14,'Theocratic republic.'],
            [44.37,33.34,'Iraq','H',41,'Fragile democracy, militia influence.'],
            [35.5,38.5,'Syria','A',0,'HTS governance, post-Assad.'],
            [35.22,31.77,'Israel','D',77,'Democracy, occupation complicates.'],
            [36.81,3.24,'Ethiopia','H',22,'Authoritarian with formal elections.'],
            [3.39,6.45,'Nigeria','H',45,'Federal republic, governance issues.'],
            [31.24,30.06,'Egypt','A',23,'Al-Sisi military state.'],
            [13.51,2.12,'Niger','A',9,'Military junta 2023.'],
            [-7.99,12.36,'Guinea','A',6,'Military junta 2021.'],
            [15.5,32.5,'Sudan','A',5,'SAF/RSF military conflict state.'],
            [96.0,17.0,'Myanmar','A',5,'Military junta 2021.'],
            [48.5,37.5,'Kazakhstan','A',24,'Authoritarian, post-Nazarbayev.'],
            [69.28,41.3,'Uzbekistan','A',17,'Authoritarian.'],
            [37.88,-6.17,'Kenya','H',57,'Republic.'],
            [28.28,-25.75,'South Africa','D',79,'Constitutional republic.'],
            [31.03,-17.83,'Zimbabwe','A',27,'Mnangagwa regime.'],
            [90.41,23.81,'Bangladesh','H',40,'Sheikh Hasina overthrown 2024.'],
            [72.88,19.08,'India','D',66,'Largest democracy (backsliding noted).'],
            [74.35,30.37,'Pakistan','H',38,'Hybrid civil-military.'],
            [104.93,11.57,'Cambodia','A',24,'Hun family dynasty.'],
            [102.6,17.97,'Laos','A',14,'Single-party communist.'],
            [105.83,21.03,'Vietnam','A',20,'Single-party communist.'],
            [116.39,39.91,'China','A',9,'CCP single-party state.'],
            [125.73,39.03,'North Korea','A',3,'Kim dynasty totalitarianism.'],
            [37.62,55.75,'Russia','A',16,'Repeat'],
            [39.27,17.32,'Eritrea','A',3,'One of world\'s most closed states.'],
            [57.5,23.6,'Saudi Arabia','A',8,'Absolute monarchy.'],
            [54.37,24.47,'UAE','A',18,'Federation of monarchies.'],
            [51.53,25.29,'Qatar','A',25,'Emirate, press freedoms improving.'],
            [50.6,26.22,'Bahrain','A',13,'Absolute monarchy.'],
            [58.59,23.61,'Oman','A',20,'Absolute monarchy.'],
            [47.48,29.37,'Kuwait','H',36,'Constitutional emirate.'],
            [35.22,33.36,'Palestine','H',35,'Split: PA (WB) vs Hamas (Gaza).'],
            [55.27,25.2,'Lebanon','H',43,'Sectarian system, Hezbollah influence.'],
            [36.82,34.02,'Libya','A',9,'Split governance, militia fragmentation.'],
            [32.5,14.0,'Algeria','A',34,'Military-guided state.'],
            [9.54,33.89,'Tunisia','A',37,'Saied dismantled democracy 2021.'],
            [4.0,13.51,'Cameroon','A',24,'Biya 40-year rule.'],
            [29.36,-1.0,'DR Congo','A',20,'Fragile state.'],
            [30.06,-1.94,'Rwanda','A',22,'Kagame authoritarian.'],
            [85.32,27.72,'Nepal','D',69,'Federal republic.'],
            [80.0,7.87,'Sri Lanka','H',56,'Democratic recovery post-crisis.'],
            [46.86,-11.7,'Madagascar','A',37,'Political instability.'],
            [-4.01,5.36,'Ivory Coast','H',49,'Electoral reforms ongoing.'],
        ];

        const col = { D:'#3399ff', H:'#ffb000', A:'#ff3300' };
        const label = { D:'DEMOCRACY', H:'HYBRID / PARTLY FREE', A:'AUTHORITARIAN' };
        const fh = { D:'Free', H:'Partly Free', A:'Not Free' };

        countries.forEach(([lon, lat, country, regime, score, note]) => {
            const c = col[regime] || '#888';
            const el = document.createElement('div');
            el.style.cssText = `width:10px;height:10px;border-radius:50%;background:${c};cursor:pointer;opacity:0.85;border:1px solid ${c}88;`;
            el.style.filter = `drop-shadow(0 0 3px ${c})`;
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '260px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:${c};margin:0 0 5px;border-bottom:1px solid ${c}44;padding-bottom:4px;">${country}</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;">
                    <div style="background:${c}11;padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">REGIME</div><div style="color:${c};font-size:.7rem;">${label[regime]}</div></div>
                    <div style="background:${c}11;padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">STATUS</div><div style="font-size:.7rem;">${fh[regime]}</div></div>
                </div>
                <div style="margin-bottom:4px;"><span style="opacity:.5;font-size:.6rem;">FREEDOM HOUSE SCORE: </span><strong style="color:${c};">${score}/100</strong></div>
                <div style="font-size:.65rem;opacity:.7;line-height:1.4;">${note}</div>
                <div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: Freedom House 2024</div>
                </div>`);
            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat]).setPopup(popup);
            regimeMarkers.push(m);
            if (toggles.regimes) m.addTo(map);
        });
    };

    // ============================================================
    // GEOPOLITICAL BLOCS — NATO / BRICS / SCO / AUKUS / Neutral
    // ============================================================
    const blocMarkers = [];
    // Capital + population lookup for bloc popup enrichment
    const COUNTRY_META = {
        'USA':            { cap: 'Washington D.C.', pop: '334M' },
        'UK':             { cap: 'London',          pop: '68M'  },
        'France':         { cap: 'Paris',           pop: '68M'  },
        'Germany':        { cap: 'Berlin',          pop: '84M'  },
        'Italy':          { cap: 'Rome',            pop: '59M'  },
        'Spain':          { cap: 'Madrid',          pop: '48M'  },
        'Netherlands':    { cap: 'Amsterdam',       pop: '18M'  },
        'Sweden':         { cap: 'Stockholm',       pop: '10M'  },
        'Finland':        { cap: 'Helsinki',        pop: '5.6M' },
        'Denmark':        { cap: 'Copenhagen',      pop: '5.9M' },
        'Norway':         { cap: 'Oslo',            pop: '5.5M' },
        'Portugal':       { cap: 'Lisbon',          pop: '10M'  },
        'Ireland':        { cap: 'Dublin',          pop: '5.1M' },
        'Hungary':        { cap: 'Budapest',        pop: '10M'  },
        'Poland':         { cap: 'Warsaw',          pop: '38M'  },
        'Czech Republic': { cap: 'Prague',          pop: '11M'  },
        'Slovakia':       { cap: 'Bratislava',      pop: '5.4M' },
        'Romania':        { cap: 'Bucharest',       pop: '19M'  },
        'Bulgaria':       { cap: 'Sofia',           pop: '6.5M' },
        'Austria':        { cap: 'Vienna',          pop: '9.1M' },
        'Lithuania':      { cap: 'Vilnius',         pop: '2.8M' },
        'Latvia':         { cap: 'Riga',            pop: '1.8M' },
        'Estonia':        { cap: 'Tallinn',         pop: '1.3M' },
        'Canada':         { cap: 'Ottawa',          pop: '40M'  },
        'Australia':      { cap: 'Canberra',        pop: '26M'  },
        'New Zealand':    { cap: 'Wellington',       pop: '5.2M' },
        'Japan':          { cap: 'Tokyo',           pop: '124M' },
        'South Korea':    { cap: 'Seoul',           pop: '52M'  },
        'Turkey':         { cap: 'Ankara',          pop: '85M'  },
        'Greece':         { cap: 'Athens',          pop: '10M'  },
        'Albania':        { cap: 'Tirana',          pop: '2.8M' },
        'Montenegro':     { cap: 'Podgorica',       pop: '0.6M' },
        'North Macedonia':{ cap: 'Skopje',          pop: '1.8M' },
        'Russia':         { cap: 'Moscow',          pop: '144M' },
        'China':          { cap: 'Beijing',         pop: '1,425M'},
        'Brazil':         { cap: 'Brasília',        pop: '216M' },
        'India':          { cap: 'New Delhi',       pop: '1,442M'},
        'South Africa':   { cap: 'Pretoria',        pop: '60M'  },
        'Iran':           { cap: 'Tehran',          pop: '88M'  },
        'Egypt':          { cap: 'Cairo',           pop: '111M' },
        'Ethiopia':       { cap: 'Addis Ababa',     pop: '126M' },
        'UAE':            { cap: 'Abu Dhabi',       pop: '10M'  },
        'Uzbekistan':     { cap: 'Tashkent',        pop: '35M'  },
        'Pakistan':       { cap: 'Islamabad',       pop: '231M' },
        'Kazakhstan':     { cap: 'Astana',          pop: '20M'  },
        'Kyrgyzstan':     { cap: 'Bishkek',         pop: '7M'   },
        'Tajikistan':     { cap: 'Dushanbe',        pop: '10M'  },
        'Nepal':          { cap: 'Kathmandu',       pop: '30M'  },
        'Switzerland':    { cap: 'Bern',            pop: '8.8M' },
        'Mexico':         { cap: 'Mexico City',     pop: '129M' }
    };
    const initGeoBlocs = () => {
        // [lon, lat, country, bloc, since, note]
        const blocs = [
            // NATO (29 + 2 members as of 2024)
            [-77.04,38.89,'USA','NATO',1949,'Founding member. Largest contributor.'],
            [-3.44,55.38,'UK','NATO',1949,'Nuclear power, P5 member.'],
            [2.35,48.85,'France','NATO',1949,'Nuclear power, rejoined integrated command 2009.'],
            [13.38,52.52,'Germany','NATO',1955,'Largest non-nuclear European economy.'],
            [12.48,41.89,'Italy','NATO',1949,'Founding member. US bases (Aviano, Sigonella).'],
            [2.17,41.39,'Spain','NATO',1982,''],
            [4.89,52.37,'Netherlands','NATO',1949,'Founding member. US nuclear sharing.'],
            [18.07,59.33,'Sweden','NATO',2024,'Joined Mar 2024 (Russia\'s war triggered decision).'],
            [24.94,60.17,'Finland','NATO',2023,'Joined Apr 2023. 1,300km Russia border.'],
            [12.57,55.68,'Denmark','NATO',1949,'Founding member. Greenland key.'],
            [10.75,59.91,'Norway','NATO',1949,'Russia border. Svalbard strategic.'],
            [-8.61,41.56,'Portugal','NATO',1949,'Founding member. Azores strategic.'],
            [-6.27,53.33,'Ireland','NATO',0,'NEUTRAL — EU member, not NATO.'],
            [19.04,47.5,'Hungary','NATO',1999,'Orbán blocks Ukraine aid frequently.'],
            [21.01,52.23,'Poland','NATO',1999,'Largest NATO military buildup in Europe.'],
            [14.44,50.08,'Czech Republic','NATO',1999,''],
            [17.11,48.15,'Slovakia','NATO',1999,''],
            [26.1,44.44,'Romania','NATO',2004,'US Aegis Ashore missile defense site.'],
            [23.32,42.7,'Bulgaria','NATO',2004,''],
            [16.37,48.21,'Austria','NATO',0,'NEUTRAL — Constitutional neutrality.'],
            [27.56,53.9,'Lithuania','NATO',2004,'Russia Kaliningrad border.'],
            [24.11,56.95,'Latvia','NATO',2004,''],
            [25.27,54.69,'Estonia','NATO',2004,''],
            [-79.38,43.65,'Canada','NATO',1949,'Founding member. NORAD.'],
            [151.21,-33.87,'Australia','NATO',0,'AUKUS (not NATO). US-UK-AU pact.'],
            [174.78,-36.87,'New Zealand','NATO',0,'Five Eyes. Not AUKUS.'],
            [139.69,35.69,'Japan','NATO',0,'US alliance. Not NATO but quasi-allied.'],
            [126.98,37.57,'South Korea','NATO',0,'US alliance. Not NATO.'],
            [32.85,39.93,'Turkey','NATO',1952,'Member but complex — S-400, vetoes.'],
            [23.72,37.98,'Greece','NATO',1952,''],
            [19.82,41.33,'Albania','NATO',2009,''],
            [19.25,42.44,'Montenegro','NATO',2017,''],
            [21.44,41.99,'North Macedonia','NATO',2020,''],
            // BRICS
            [37.61,55.75,'Russia','BRICS',2006,'Founding. Sanctioned. War in Ukraine.'],
            [116.39,39.91,'China','BRICS',2006,'Founding. World\'s 2nd economy.'],
            [-47.93,-15.78,'Brazil','BRICS',2006,'Founding. Largest LatAm economy. Lula.'],
            [72.88,19.08,'India','BRICS',2006,'Founding. Largest democracy. Non-aligned.'],
            [28.28,-25.75,'South Africa','BRICS',2010,'Only African founding member.'],
            [51.43,35.69,'Iran','BRICS',2024,'Joined Jan 2024. Sanctioned.'],
            [31.24,30.06,'Egypt','BRICS',2024,'Joined Jan 2024.'],
            [24.68,59.44,'Ethiopia','BRICS',2024,'Joined Jan 2024.'],
            [54.37,24.47,'UAE','BRICS',2024,'Joined 2024. Hedging strategy.'],
            // SCO (Shanghai Cooperation Organisation)
            [69.28,41.3,'Uzbekistan','SCO',2001,''],
            [74.35,30.37,'Pakistan','SCO',2017,''],
            [71.43,51.18,'Kazakhstan','SCO',2001,''],
            [74.6,42.87,'Kyrgyzstan','SCO',2001,''],
            [68.75,38.56,'Tajikistan','SCO',2001,''],
            [85.32,27.72,'Nepal','SCO',0,'Observer.'],
            // AUKUS
            [133.77,-25.27,'Australia','AUKUS',2021,'Nuclear submarine tech transfer.'],
            // Core neutrals
            [7.45,46.96,'Switzerland','NEUTRAL',0,'Traditional armed neutrality.'],
            [19.04,47.5,'Hungary','NATO',1999,'See NATO entry'],
            [-106.34,23.63,'Mexico','NEUTRAL',0,'Non-aligned. US relations complex.'],
            [88.37,22.57,'India','NEUTRAL',0,'Strategic autonomy. SCO + BRICS + Quad.'],
        ];

        const cols = { NATO:'#4488ff', BRICS:'#ff4400', SCO:'#ff8800', AUKUS:'#00ffcc', NEUTRAL:'#888888' };
        blocs.forEach(([lon, lat, country, bloc, since, note]) => {
            const c = cols[bloc] || '#888';
            const el = document.createElement('div');
            const size = bloc === 'NEUTRAL' ? '7px' : '10px';
            el.style.cssText = `width:${size};height:${size};border-radius:50%;background:transparent;border:2px solid ${c};cursor:pointer;`;
            el.style.filter = `drop-shadow(0 0 3px ${c})`;
            const meta = COUNTRY_META[country];
            const capLabel = currentLang === 'de' ? 'HAUPTSTADT' : 'CAPITAL';
            const popLabel = currentLang === 'de' ? 'BEVÖLKERUNG' : 'POPULATION';
            const sinceLabel = currentLang === 'de' ? `Mitglied seit ${since}` : `Member since ${since}`;
            const nonLabel = currentLang === 'de' ? 'Kein Mitglied' : 'Non-member';
            const metaRow = meta ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;">
                <div style="background:rgba(255,255,255,.04);padding:3px 6px;">
                    <div style="opacity:.45;font-size:.55rem;">${capLabel}</div>
                    <div style="color:#fff;font-size:.7rem;">${meta.cap}</div>
                </div>
                <div style="background:rgba(255,255,255,.04);padding:3px 6px;">
                    <div style="opacity:.45;font-size:.55rem;">${popLabel}</div>
                    <div style="color:#fff;font-size:.7rem;">${meta.pop}</div>
                </div>
            </div>` : '';
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '260px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:${c};margin:0 0 5px;border-bottom:1px solid ${c}44;padding-bottom:3px;">${country}</h3>
                ${metaRow}
                <div style="background:${c}22;padding:4px 7px;border-left:2px solid ${c};margin-bottom:5px;">
                    <strong>${bloc}</strong>${since ? ` &mdash; ${sinceLabel}` : ` &mdash; ${nonLabel}`}
                </div>
                <div style="font-size:.65rem;opacity:.75;">${note || (currentLang === 'de' ? 'Keine weiteren Daten.' : 'No additional data.')}</div>
                </div>`);
            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat]).setPopup(popup);
            blocMarkers.push(m);
            if (toggles.blocs) m.addTo(map);
        });
    };

    // ============================================================
    // UNDERSEA CABLES — Major global submarine cable routes
    // Simplified polylines for the ~20 most strategic cable systems
    // ============================================================
    const initUnderseaCables = () => {
        // Ocean-routed submarine cable coordinates
        // All paths verified to stay in open water / hug coastlines
        // Red Sea routing: Med ? Port Said [32.3,31] ? Red Sea ? Bab el-Mandeb [43,11.5]
        const cables = [
            // ── ATLANTIC ─────────────────────────────────────────────────────
            { name: 'TAT-14 (Transatlantic)', color: '#00ccff',
              capacity: '3.2 Tbps', year: 2001, length: '15,428 km', owner: 'KPN / Sprint / Deutsche Telekom',
              coords: [[-74,40],[-55,44],[-30,47],[-15,50],[-8,52],[-5,50],[1,51]] },
            { name: 'MAREA (Microsoft/Facebook)', color: '#44aaff',
              capacity: '160 Tbps', year: 2017, length: '6,600 km', owner: 'Microsoft / Meta',
              coords: [[-74,40.7],[-45,40],[-20,40],[-8.6,41.5]] },
            { name: 'DUNANT (Google)', color: '#44aaff',
              capacity: '250 Tbps', year: 2021, length: '6,600 km', owner: 'Google LLC',
              coords: [[-81,24.5],[-60,27],[-30,30],[-10,35],[-8.6,43.5]] },
            { name: 'Grace Hopper (Google)', color: '#8888ff',
              capacity: '340 Tbps', year: 2022, length: '5,950 km', owner: 'Google LLC',
              coords: [[-74,40.7],[-40,42],[-15,48],[-8.6,43.5],[-8.6,51.5]] },
            { name: 'Havfrue / AEC (Amazon)', color: '#6699ff',
              capacity: '345 Tbps', year: 2020, length: '8,742 km', owner: 'Amazon / Google / Meta',
              coords: [[-71,42],[-45,44],[-20,47],[-5,51],[1,51],[5.5,58.7],[10.7,55.7]] },
            { name: 'South Atlantic (SACS)', color: '#ff4444',
              capacity: '40 Gbps', year: 2000, length: '7,250 km', owner: 'Angola Portugal consortium',
              coords: [[-8.8,38.7],[-20,-15],[-35,-22],[-43,-22.9]] },
            // ── EUROPE / MED ? INDIAN OCEAN via Suez ─────────────────────────
            { name: 'SEA-ME-WE 3', color: '#ff00cc',
              capacity: '960 Gbps', year: 1999, length: '39,000 km', owner: '92-nation consortium',
              coords: [
                [2,51],[-5,36],[12,37],[16,38],[25,35],[31,32],
                [32.3,31.2],[32.5,29.9],
                [36.5,22],[38,16],[42.5,12],[43.5,11.5],
                [50,11],[57,22],[67,24],[72,20],[80,7],[98,3],[104,1.3],
                [109,3],[121,14],[126,37],[135,34],[140,35]
              ] },
            { name: 'FLAG (Fibre Link Around Globe)', color: '#ffff00',
              capacity: '10 Gbps', year: 1997, length: '27,300 km', owner: 'FLAG Telecom',
              coords: [
                [1,51],[12,37],[25,35],[31,32],
                [32.3,31.2],[32.5,29.9],[38,16],[43.5,11.5],
                [50,11],[57,22],[72,20],[80,6],[104,1.3],[121,24],[140,36]
              ] },
            { name: 'PEACE Cable', color: '#ff6600',
              capacity: '60 Tbps', year: 2022, length: '15,000 km', owner: 'PEACE Cable International',
              coords: [
                [-7,53],[-9,39],[-5,36],[12,37],[25,35],[31,32],
                [32.3,31.2],[32.5,29.9],[38,16],[43.5,11.5],
                [50,11],[57,22],[67,24],[80,21],[104,1],[120,22]
              ] },
            { name: 'AA-1 (Asia-Africa)', color: '#ffaa00',
              capacity: '100 Tbps', year: 2020, length: '25,000 km', owner: 'Alcatel / consortium',
              coords: [
                [31,32],[32.3,31.2],[32.5,29.9],[38,16],[43.5,11.5],
                [50,11],[57,22],[67,24],[80,21],[104,1],[121,25]
              ] },
            // ── AFRICA COASTS ────────────────────────────────────────────────
            { name: 'SAT-3 / WASC (Africa West)', color: '#ff8800',
              capacity: '120 Gbps', year: 2002, length: '14,350 km', owner: 'West African consortium',
              coords: [
                [-8.7,41.7],[-9,39],[-13,25],[-17,14.5],[-17.5,13],
                [-17,12],[-15,9],[-5,5],[0,4.5],[8.5,4],[10,3.5],
                [9.5,4],[12,-5],[12,-8],[12,-15],[13,-23],[17,-28],[18,-34]
              ] },
            { name: 'SEACOM (Africa East)', color: '#ff8800',
              capacity: '1.28 Tbps', year: 2009, length: '17,000 km', owner: 'Seacom Ltd',
              coords: [
                [18,-34],[27,-30],[33,-26],[36,-20],[40,-11],
                [40,-5],[41,2],[43.5,11.5],[50,11],[51,20],[57,21],[58,23],[72,20]
              ] },
            // ── TRANS-PACIFIC ─── extended lon: 140°E=-220, 130°E=-230, 121°E=-239
            { name: 'Trans-Pacific (TPE)', color: '#00ff88',
              capacity: '17.7 Tbps', year: 2016, length: '17,700 km', owner: 'Asia-Pacific Telecom consortium',
              coords: [[-118,34],[-130,30],[-145,23],[-157,20],[-170,8],[-178,5],
                       [-200,8],[-216,13],[-220,34],[-230,35],[-234,37],[-239,26],[-240,22]] },
            { name: 'FASTER (Google Trans-Pacific)', color: '#00ff88',
              capacity: '60 Tbps', year: 2016, length: '9,000 km', owner: 'Google / SoftBank / China Mobile',
              coords: [[-122,38],[-140,29],[-157,21],[-175,15],[-200,18],[-215,33],[-220,36],[-240,27]] },
            { name: 'Jupiter (Google)', color: '#55ddaa',
              capacity: '60 Tbps', year: 2020, length: '14,557 km', owner: 'Google / PLDT / SoftBank',
              coords: [[-121,38],[-140,30],[-157,21],[-175,15],[-200,14],[-215,32],[-220,34],[-228,37]] },
            // ── PACIFIC ─────────────────────────────────────────────────────
            { name: 'SJC (South Japan Cable)', color: '#88ff88',
              capacity: '2.56 Tbps', year: 2009, length: '8,900 km', owner: 'SJC consortium',
              coords: [[104,1.3],[110,3],[121,25],[126,26],[128,26],[132,34],[137,35],[140,35]] },
            // ── ARCTIC / POLAR ───────────────────────────────────────────────
            { name: 'Arctic Fibre', color: '#aaaaff',
              capacity: '160 Tbps (planned)', year: 2025, length: '15,600 km', owner: 'Far North Digital',
              coords: [[17,69],[5,62],[0,60],[-5,58],[-30,64],[-55,67],
                [-75,72],[-90,71],[-100,70],[-120,68]] },
            // ── RUSSIA-JAPAN ─────────────────────────────────────────────────
            { name: 'Russia-Japan (RJCN)', color: '#ff8888',
              capacity: '640 Gbps', year: 2013, length: '1,520 km', owner: 'KDDI / RTComm.RU',
              coords: [[132,43],[134,43],[136,40],[138,38],[140,36],[140.5,35],[141,35]] },
            // ── ADDITIONAL MAJOR CABLES ────────────────────────────────
            { name: '2Africa (Meta)', color: '#ff44ff',
              capacity: '180 Tbps', year: 2024, length: '45,000 km', owner: 'Meta / Vodafone / Orange / MTN',
              coords: [
                [-8,37],[-15,28],[-17,15],[-17,12],[-15,9],[-5,5],[0,4.5],[8.5,4],[12,-5],
                [12,-15],[13,-23],[18,-34],[27,-30],[36,-20],[40,-11],[43.5,11.5],
                [50,11],[57,22],[67,24],[72,20],[80,6],[104,1],[121,24]
              ] },
            { name: 'Equiano (Google Africa)', color: '#00dd88',
              capacity: '144 Tbps', year: 2024, length: '12,000 km', owner: 'Google LLC',
              coords: [[-8.6,39],[-15,28],[-17,15],[-15,9],[-5,5],[0,4.5],[8.5,4],[12,-5],[12,-15],[13,-23],[18,-34]] },
            { name: 'EIG (Europe-India Gateway)', color: '#cc88ff',
              capacity: '3.84 Tbps', year: 2011, length: '15,000 km', owner: 'EIG Consortium',
              coords: [
                [1,51],[-5,36],[12,37],[25,35],[31,32],[32.3,31.2],[32.5,29.9],
                [38,16],[43.5,11.5],[50,11],[57,22],[67,24],[72,20]
              ] },
            { name: 'AAE-1 (Asia-Africa-Europe)', color: '#ff88aa',
              capacity: '40 Tbps', year: 2017, length: '25,000 km', owner: 'AAE-1 Consortium',
              coords: [
                [-7,53],[-5,36],[12,37],[25,35],[31,32],[32.3,31.2],[32.5,29.9],
                [38,16],[43.5,11.5],[50,11],[57,22],[67,24],[72,20],[80,7],[98,3],[104,1.3]
              ] },
            { name: 'Apricot (Google/Meta APAC)', color: '#44ddaa',
              capacity: '190 Tbps', year: 2024, length: '12,000 km', owner: 'Google / Meta / NTT',
              coords: [[140,35],[130,30],[121,25],[118,14],[110,3],[104,1.3]] },
        ];

        const geojson = {
            type: 'FeatureCollection',
            features: cables.map(c => ({
                type: 'Feature',
                properties: { name: c.name, color: c.color, capacity: c.capacity, year: c.year, length: c.length, owner: c.owner },
                geometry: { type: 'LineString', coordinates: c.coords }
            }))
        };

        map.addSource('cables-src', { type: 'geojson', data: geojson });
        map.addLayer({
            id: 'cables-layer',
            type: 'line',
            source: 'cables-src',
            layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': ['get', 'color'],
                'line-width': 1.5,
                'line-opacity': 0.75
            }
        });

        // Popup on cable click — shows capacity, owner, year, length
        map.on('click', 'cables-layer', (e) => {
            const { name, color, capacity, year, length, owner } = e.features[0].properties;
            new maplibregl.Popup({ maxWidth: '270px' })
                .setLngLat(e.lngLat)
                .setHTML(`<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                    <h3 style="color:${color};margin:0 0 8px;border-bottom:1px solid ${color}44;padding-bottom:5px;">🔌 ${name}</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="opacity:.5;padding:2px 0;">CAPACITY</td><td style="color:${color};font-weight:bold;text-align:right;">${capacity || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">LENGTH</td><td style="color:#ccc;text-align:right;">${length || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">ACTIVE SINCE</td><td style="color:#ccc;text-align:right;">${year || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">OWNER</td><td style="color:#aaa;text-align:right;font-size:.65rem;">${owner || 'Consortium'}</td></tr>
                    </table>
                    <div style="font-size:.57rem;opacity:.35;margin-top:6px;">Source: TeleGeography SubmarineCableMap 2024</div>
                </div>`)
                .addTo(map);
        });
        map.on('mouseenter', 'cables-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'cables-layer', () => { map.getCanvas().style.cursor = ''; });
    };

    // ============================================================
    // ENERGY PIPELINES — Major oil & gas pipelines (curated dataset)
    // ============================================================
    const initPipelines = () => {
        const pipelines = [
            // ── EUROPEAN GAS ───────────────────────────────────────────
            { name: 'Nord Stream 1 & 2 (destroyed)', color: '#ff4444', type: 'Gas',
              capacity: '110 bcm/yr (before sabotage)', year: '2011/2021', length: '1,224 km', status: 'Destroyed Sept 2022',
              coords: [[30.1,59.9],[27,59],[22,57],[18,56],[14,55],[12.1,54.1]] },
            { name: 'TurkStream', color: '#ff8800', type: 'Gas',
              capacity: '31.5 bcm/yr', year: 2020, length: '930 km', status: 'Active',
              coords: [[37.8,44.6],[35,43],[31,42],[29,41.5],[28.5,41.2]] },
            { name: 'Yamal–Europe', color: '#ffaa00', type: 'Gas',
              capacity: '33 bcm/yr', year: 1999, length: '4,107 km', status: 'Reduced flow',
              coords: [[68,66],[60,62],[50,56],[40,53],[30,52],[23,52],[18,52],[14,52]] },
            { name: 'Druzhba (Friendship) Oil', color: '#cc6600', type: 'Oil',
              capacity: '1.2 mbl/day', year: 1964, length: '5,500 km', status: 'Active (southern branch)',
              coords: [[52,54],[45,53],[38,52],[32,52],[28,51],[24,52],[20,50],[18,49],[14,49]] },
            { name: 'TAP (Trans-Adriatic)', color: '#44aaff', type: 'Gas',
              capacity: '10 bcm/yr', year: 2020, length: '878 km', status: 'Active',
              coords: [[28.5,41],[25,41],[22,40.5],[20.5,40],[20,40.2],[18.5,40.8]] },
            { name: 'TANAP (Trans-Anatolian)', color: '#44aaff', type: 'Gas',
              capacity: '16 bcm/yr', year: 2018, length: '1,850 km', status: 'Active',
              coords: [[43.4,40.2],[40,39.5],[37,38],[34,38],[32,39],[29,40],[28.5,41]] },
            { name: 'BTC (Baku–Tbilisi–Ceyhan) Oil', color: '#ff6600', type: 'Oil',
              capacity: '1.2 mbl/day', year: 2006, length: '1,768 km', status: 'Active',
              coords: [[49.9,40.4],[48,40.5],[45,41.5],[44,41.7],[42,39],[37,37],[36,36.5]] },
            { name: 'Blue Stream', color: '#6688ff', type: 'Gas',
              capacity: '16 bcm/yr', year: 2005, length: '1,213 km', status: 'Active',
              coords: [[37.8,44.6],[36,43.5],[34,42],[32,41.5],[30,41.5],[29,41.2]] },
            { name: 'Nord Stream backup via LNG terminals', color: '#aaaaaa', type: 'LNG',
              capacity: 'Various', year: 2022, length: 'Multiple', status: 'Active — EU diversification',
              coords: [[-5.5,36],[0,42],[3,51],[5,53],[8,54],[10,54.5],[13,54.5]] },
            // ── MIDDLE EAST / CENTRAL ASIA ─────────────────────────────
            { name: 'East–West (Saudi Petroline) Oil', color: '#cc0000', type: 'Oil',
              capacity: '5 mbl/day', year: 1981, length: '1,200 km', status: 'Active',
              coords: [[50.1,26.3],[48,25],[46,24.5],[44,24],[42,24],[40,24],[39,21.5]] },
            { name: 'TAPI (Turkmenistan–Afghanistan–Pakistan–India)', color: '#ffcc00', type: 'Gas',
              capacity: '33 bcm/yr (planned)', year: 'Under construction', length: '1,814 km', status: 'Planned/Construction',
              coords: [[62,38],[63,35],[65,33],[67,30],[68,27],[69,25]] },
            { name: 'Iran–Turkey Gas', color: '#ff5500', type: 'Gas',
              capacity: '10 bcm/yr', year: 2001, length: '2,577 km', status: 'Active',
              coords: [[52,33],[48,36],[45,38],[43,39.5],[40,39.5]] },
            // ── AFRICA ────────────────────────────────────────────────
            { name: 'Trans-Saharan Gas (NIGAL)', color: '#ffdd00', type: 'Gas',
              capacity: '30 bcm/yr (planned)', year: 'Planned', length: '4,128 km', status: 'Planned — Nigeria?Algeria?Europe',
              coords: [[3,6.5],[5,10],[4,15],[3,20],[3,25],[2,30],[2,35],[1,36]] },
            { name: 'Sumed (Egypt) Oil', color: '#cc3300', type: 'Oil',
              capacity: '2.5 mbl/day', year: 1977, length: '320 km', status: 'Active — bypasses Suez Canal',
              coords: [[33.8,28.7],[32.5,29.5],[31.2,30.5],[29.9,31]] },
            // ── AMERICAS ──────────────────────────────────────────────
            { name: 'Keystone XL (Cancelled) + Keystone', color: '#886600', type: 'Oil',
              capacity: '0.59 mbl/day (Keystone)', year: 2010, length: '3,462 km', status: 'Keystone active; XL cancelled 2021',
              coords: [[-110,52],[-108,49],[-104,46],[-100,43],[-98,40],[-97,37],[-97,30]] },
            { name: 'Trans-Alaska (TAPS) Oil', color: '#995500', type: 'Oil',
              capacity: '0.5 mbl/day', year: 1977, length: '1,288 km', status: 'Active — declining throughput',
              coords: [[-148,70],[-147,67],[-146,64],[-146,62],[-147,61]] },
            // ── RUSSIA / ASIA ─────────────────────────────────────────
            { name: 'Power of Siberia (Russia?China)', color: '#ff2222', type: 'Gas',
              capacity: '38 bcm/yr', year: 2019, length: '3,000 km', status: 'Active — ramping up',
              coords: [[130,62],[128,55],[127,50],[126,48],[128,47],[130,46]] },
            { name: 'ESPO (East Siberia–Pacific Ocean) Oil', color: '#cc4400', type: 'Oil',
              capacity: '1.6 mbl/day', year: 2012, length: '4,857 km', status: 'Active — main Russia?China/Japan oil route',
              coords: [[105,56],[110,53],[115,51],[120,50],[125,48],[130,47],[132,43]] },
            { name: 'Central Asia–China Gas', color: '#ddaa00', type: 'Gas',
              capacity: '55 bcm/yr', year: 2009, length: '1,833 km', status: 'Active — via Turkmenistan/Uzbekistan/Kazakhstan',
              coords: [[62,38],[65,40],[68,41],[72,41],[75,42],[80,44]] },
        ];

        const geojson = {
            type: 'FeatureCollection',
            features: pipelines.map(p => ({
                type: 'Feature',
                properties: { name: p.name, color: p.color, type: p.type, capacity: p.capacity, year: p.year, length: p.length, status: p.status },
                geometry: { type: 'LineString', coordinates: p.coords }
            }))
        };

        map.addSource('pipelines-src', { type: 'geojson', data: geojson });
        map.addLayer({
            id: 'pipelines-layer',
            type: 'line',
            source: 'pipelines-src',
            layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': ['get', 'color'],
                'line-width': 2.5,
                'line-opacity': 0.8,
                'line-dasharray': [4, 2]
            }
        });

        // Popup on pipeline click
        map.on('click', 'pipelines-layer', (e) => {
            const { name, color, type, capacity, year, length, status } = e.features[0].properties;
            const icon = type === 'Oil' ? '🛢️' : type === 'LNG' ? '🚢' : '🔥';
            new maplibregl.Popup({ maxWidth: '280px' })
                .setLngLat(e.lngLat)
                .setHTML(`<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                    <h3 style="color:${color};margin:0 0 8px;border-bottom:1px solid ${color}44;padding-bottom:5px;">${icon} ${name}</h3>
                    <table style="width:100%;border-collapse:collapse;">
                        <tr><td style="opacity:.5;padding:2px 0;">TYPE</td><td style="color:${color};font-weight:bold;text-align:right;">${type}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">CAPACITY</td><td style="color:#ccc;text-align:right;">${capacity || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">LENGTH</td><td style="color:#ccc;text-align:right;">${length || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">COMMISSIONED</td><td style="color:#ccc;text-align:right;">${year || 'N/A'}</td></tr>
                        <tr><td style="opacity:.5;padding:2px 0;">STATUS</td><td style="color:${status?.includes('Destroyed') || status?.includes('Cancelled') ? '#ff4444' : '#88ff88'};text-align:right;font-size:.65rem;">${status || 'Active'}</td></tr>
                    </table>
                    <div style="font-size:.57rem;opacity:.35;margin-top:6px;">Source: IEA / GIE / US EIA 2025</div>
                </div>`)
                .addTo(map);
        });
        map.on('mouseenter', 'pipelines-layer', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'pipelines-layer', () => { map.getCanvas().style.cursor = ''; });
    };

    // Pipeline toggle handler
    document.getElementById('toggle-pipelines')?.addEventListener('change', (e) => {
        toggles.pipelines = e.target.checked;
        if (toggles.pipelines && !map.getSource('pipelines-src')) initPipelines();
        if (map.getLayer('pipelines-layer'))
            map.setLayoutProperty('pipelines-layer', 'visibility', toggles.pipelines ? 'visible' : 'none');
    });

    // ============================================================
    // DATA CENTERS — Hyperscale cloud regions (AWS/Google/Azure/etc)
    // ============================================================
    const dcMarkers = [];
    const initDataCenters = () => {
        const dcs = [
            // [lon, lat, name, provider, tier, note]
            [-77.49,38.99,'US-East (N.Virginia)','AWS + Azure + Google','Tier 1','Largest cloud hub globally. Both AWS us-east-1 and Azure East US.'],
            [-87.63,41.88,'US-Central (Chicago)','AWS + Azure','Tier 1','Major US inland hub.'],
            [-118.24,34.05,'US-West (Los Angeles)','AWS + Azure + Google','Tier 1','West Coast hub.'],
            [-122.33,47.61,'US-West-2 (Seattle/Oregon)','AWS + Google','Tier 1','Amazon HQ + large Google campus.'],
            [-47.93,-15.78,'Brazil (São Paulo)','AWS + Azure + Google','Tier 1','Largest LatAm cloud hub.'],
            [-3.7,40.42,'Europe (Spain/Madrid)','AWS + Azure + Google','Tier 1','Growing Southern Europe hub.'],
            [2.35,48.85,'Europe (Paris)','AWS + Azure + Google','Tier 1','French sovereign cloud priority.'],
            [13.38,52.52,'Europe (Germany/Frankfurt)','AWS + Azure + Google','Tier 1','Europe data sovereignty hub.'],
            [-0.13,51.51,'Europe (UK/London)','AWS + Azure + Google','Tier 1','Largest European DC market.'],
            [18.07,59.33,'Nordics (Stockholm)','AWS + Google','Tier 2','Arctic cooling advantage.'],
            [24.94,60.17,'Nordics (Finland)','Google','Tier 2','Google carbon-neutral arctic DC.'],
            [28.95,41.01,'Middle East (Istanbul)','AWS + Azure','Tier 2','Bridge to MENA region.'],
            [55.27,25.2,'Middle East (Dubai/UAE)','AWS + Azure + Google','Tier 1','MENA hub. Hyperscale boom.'],
            [51.53,25.29,'Middle East (Qatar/Doha)','Azure + Google','Tier 2','Sovereign cloud for Gulf states.'],
            [39.19,21.49,'Middle East (KSA/Riyadh)','AWS + Azure + Google','Tier 1','Vision 2030 digital hub.'],
            [31.24,30.06,'Africa (Cairo/Egypt)','AWS + Azure','Tier 2','North Africa hub.'],
            [28.28,-25.75,'Africa (Johannesburg)','AWS + Azure + Google','Tier 2','Sub-Saharan Africa primary hub.'],
            [3.39,6.45,'Africa (Nigeria/Lagos)','Google + Azure','Tier 3','Emerging hub for West Africa.'],
            [72.88,19.08,'South Asia (Mumbai)','AWS + Azure + Google','Tier 1','India\'s primary cloud hub.'],
            [77.21,28.66,'South Asia (Delhi)','AWS + Azure + Google','Tier 1','India secondary hub.'],
            [80.28,13.09,'South Asia (Chennai)','AWS + Azure','Tier 2','India South DC cluster.'],
            [88.37,22.57,'South Asia (Kolkata)','AWS','Tier 3','Emerging region.'],
            [90.41,23.81,'South Asia (Dhaka)','Azure','Tier 3','New addition.'],
            [67.09,24.86,'South Asia (Karachi)','Azure','Tier 3','Pakistan emerging.'],
            [103.82,1.35,'Southeast Asia (Singapore)','AWS + Azure + Google + Meta','Tier 1','APAC data hub. Major peering point.'],
            [106.85,-6.21,'Southeast Asia (Jakarta)','AWS + Azure + Google','Tier 2','Indonesia 270M users.'],
            [100.52,13.75,'Southeast Asia (Bangkok)','AWS + Azure + Google','Tier 2','Thailand expansion.'],
            [101.69,3.16,'Southeast Asia (Malaysia)','AWS + Azure + Google','Tier 2','Johor DC boom 2024-25.'],
            [121.5,25.05,'East Asia (Taipei)','AWS + Google + Azure','Tier 2','Taiwan DC cluster.'],
            [114.11,22.55,'East Asia (Hong Kong)','AWS + Azure + Google','Tier 1','Financial hub. China gateway.'],
            [113.26,23.13,'East Asia (Guangzhou)','Alibaba + Tencent + Huawei','Tier 1','Pearl River Delta megacluster.'],
            [121.47,31.23,'East Asia (Shanghai)','Alibaba + Tencent','Tier 1','China\'s largest cloud hub.'],
            [116.39,39.91,'East Asia (Beijing)','Alibaba + Baidu + ByteDance','Tier 1','China state + hyperscale mix.'],
            [126.98,37.57,'East Asia (Seoul)','AWS + Azure + Google + Samsung','Tier 1','Korea hyperscale hub.'],
            [139.69,35.69,'East Asia (Tokyo)','AWS + Azure + Google','Tier 1','Japan primary hub.'],
            [135.49,34.69,'East Asia (Osaka)','AWS + Azure + Google','Tier 2','Japan secondary/DR site.'],
            [151.21,-33.87,'Oceania (Sydney)','AWS + Azure + Google','Tier 1','Australia primary hub.'],
            [144.96,-37.81,'Oceania (Melbourne)','AWS + Azure','Tier 2','Australia secondary.'],
            [172.63,-43.53,'Oceania (Auckland)','Google + AWS','Tier 3','NZ hub.'],
        ];

        const tierColors = { 'Tier 1': '#00ffcc', 'Tier 2': '#ffb000', 'Tier 3': '#888888' };
        dcs.forEach(([lon, lat, name, provider, tier, note]) => {
            const c = tierColors[tier] || '#888';
            const el = document.createElement('div');
            const sz = tier === 'Tier 1' ? '14px' : tier === 'Tier 2' ? '10px' : '7px';
            el.style.cssText = `width:${sz};height:${sz};cursor:pointer;`;
            el.innerHTML = `<svg width="${sz}" height="${sz}" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="12" height="12" rx="2" fill="${c}22" stroke="${c}" stroke-width="1.5"/>
                <rect x="3" y="3" width="8" height="2.5" rx="1" fill="${c}" opacity="0.7"/>
                <rect x="3" y="7" width="8" height="2.5" rx="1" fill="${c}" opacity="0.5"/>
            </svg>`;
            el.style.filter = `drop-shadow(0 0 4px ${c})`;
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '270px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:${c};margin:0 0 5px;border-bottom:1px solid ${c}44;padding-bottom:3px;">💾 ${name}</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;">
                    <div style="background:${c}11;padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">PROVIDERS</div><div style="font-size:.62rem;">${provider}</div></div>
                    <div style="background:${c}11;padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">TIER</div><div style="color:${c};">${tier}</div></div>
                </div>
                <div style="font-size:.65rem;opacity:.75;line-height:1.4;">${note}</div>
                <div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: Cloud provider public docs 2024</div>
                </div>`);
            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat]).setPopup(popup);
            dcMarkers.push(m);
            if (toggles.datacenters) m.addTo(map);
        });
    };

    // ============================================================
    // NUCLEAR — Power Plants (operational) + Arsenal (9 states)
    // ============================================================
    const nuclearMarkers = [];
    const nukeArsenalMarkers = [];
    const initNuclearLayer = () => {
        // Nuclear Power Plants — [lon, lat, name, country, reactors, capacity_gw, status, note]
        const plants = [
            [35.87,31.82,'Barakah NPP','UAE',4,5.6,'OPERATIONAL','First Arab nuclear power plant. APR-1400 reactors.'],
            [29.15,48.22,'Zaporizhzhia NPP','Ukraine',6,5.7,'OCCUPIED','Largest in Europe. Russian-occupied since Mar 2022.'],
            [28.33,54.63,'Ignalina NPP','Lithuania',0,0,'SHUT DOWN','Shut down 2009 (EU requirement). Chernobyl-type reactor.'],
            [30.1,51.39,'Chernobyl','Ukraine',0,0,'SARCOPHAGUS','Destroyed 1986. New confinement structure 2016.'],
            [53.97,26.22,'Bushehr NPP','Iran',1,0.95,'OPERATIONAL','Iran\'s only NPP. Russian-built VVER-1000.'],
            [72.3,21.7,'Kakrapar NPP','India',2,0.44,'OPERATIONAL','PHWR reactors. NPCIL operated.'],
            [76.4,29.9,'Narora NPP','India',2,0.44,'OPERATIONAL',''],
            [80.28,12.5,'Madras NPP','India',2,0.44,'OPERATIONAL',''],
            [74.12,15.42,'Kaiga NPP','India',4,0.88,'OPERATIONAL',''],
            [76.72,9.2,'Kudankulam NPP','India',2,2.0,'OPERATIONAL','Russian-built. Largest in India.'],
            [91.95,22.16,'Rooppur NPP','Bangladesh',2,2.4,'BUILDING','Russian Rosatom build. Online ~2025.'],
            [126.42,35.41,'Hanul NPP','South Korea',6,5.9,'OPERATIONAL',''],
            [129.38,35.64,'Hanbit NPP','South Korea',6,5.9,'OPERATIONAL',''],
            [129.31,35.29,'Kori NPP','South Korea',4,4.0,'OPERATIONAL','Oldest SK plant. Kori-1 shut 2017.'],
            [126.72,37.71,'Wolsong NPP','South Korea',4,2.8,'OPERATIONAL','CANDU heavy water reactors.'],
            [140.54,41.18,'Higashidori NPP','Japan',1,1.1,'SUSPENDED','Post-Fukushima shutdown.'],
            [141.0,37.42,'Fukushima Daiichi','Japan',0,0,'DECOMMISSION','Meltdown 2011. ~40yr decommission ongoing.'],
            [136.43,35.72,'Takahama NPP','Japan',4,3.3,'PARTIAL','2 reactors restarted post-Fukushima.'],
            [136.2,35.55,'Mihama NPP','Japan',1,0.83,'OPERATIONAL',''],
            [140.38,38.26,'Ōnagawa NPP','Japan',3,2.2,'OPERATIONAL','Restarted 2024.'],
            [121.63,29.88,'Qinshan NPP','China',9,6.6,'OPERATIONAL','First Chinese-built NPP.'],
            [120.52,30.44,'Sanmen NPP','China',2,2.5,'OPERATIONAL','First AP1000 globally.'],
            [113.51,22.76,'Daya Bay NPP','China',2,1.97,'OPERATIONAL','HTR-PM demo reactor adjacent.'],
            [108.43,21.7,'Fangchenggang NPP','China',2,2.0,'OPERATIONAL','ACPR-1000. Hualong-1 under const.'],
            [119.45,35.72,'Tianwan NPP','China',6,6.1,'OPERATIONAL','Largest Russian-Chinese cooperation project.'],
            [121.8,37.7,'Hongyanhe NPP','China',6,6.1,'OPERATIONAL',''],
            [113.34,22.08,'Taiwan: Maanshan','Taiwan',2,1.9,'RETIRING','Unit 2 retired May 2023. Last plant closing.'],
            [150.14,35.34,'Tokai Daini','Japan',1,1.1,'SUSPENDED',''],
            [33.55,36.35,'Akkuyu NPP','Turkey',4,4.8,'BUILDING','Russian Rosatom build. First reactor 2025.'],
            [51.43,35.69,'Iran (all sites)','Iran',1,0.95,'OPERATIONAL','See Bushehr above.'],
            [27.52,48.09,'Cernavodă NPP','Romania',2,1.4,'OPERATIONAL','CANDU type. Expanding +2 units.'],
            [30.39,46.84,'South Ukraine NPP','Ukraine',3,3.0,'OPERATIONAL','War threat.'],
            [33.76,47.83,'Rivne NPP','Ukraine',4,2.8,'OPERATIONAL',''],
            [30.17,49.84,'Khmelnytskyi NPP','Ukraine',2,2.0,'OPERATIONAL',''],
            [27.33,48.68,'Pivdennoukrainsk','Ukraine',3,3.0,'OPERATIONAL',''],
            [37.33,53.26,'Smolensk NPP','Russia',3,3.0,'OPERATIONAL','RBMK reactors (Chernobyl type).'],
            [33.87,67.46,'Kola NPP','Russia',4,1.76,'OPERATIONAL','Northernmost NPP. Oldest operating.'],
            [56.75,56.84,'Beloyarsk NPP','Russia',2,0.88,'OPERATIONAL','BN-800 fast breeder reactor.'],
            [49.22,52.37,'Balakovo NPP','Russia',4,4.0,'OPERATIONAL','Largest in Russia.'],
            [37.77,55.23,'Novovoronezh NPP','Russia',5,4.1,'OPERATIONAL','VVER-1200 Gen III+ demonstration.'],
            [34.28,67.45,'Leningrad NPP','Russia',4,4.0,'OPERATIONAL','Also RBMK type. Being replaced.'],
            [54.93,56.81,'Sverdlovsk (Ural)','Russia',1,0.88,'BUILDING',''],
            [-74.96,41.08,'Indian Point NPP','USA',0,0,'SHUT DOWN','NY plant. Closed 2021.'],
            [-90.06,34.32,'Grand Gulf NPP','USA',1,1.3,'OPERATIONAL',''],
            [-84.06,41.97,'Davis-Besse','USA',1,0.89,'OPERATIONAL','Near-miss events history.'],
            [-76.27,40.26,'Three Mile Island','USA',0,0,'RESTARTING','TMI Unit 1 restarting 2028 (Microsoft contract).'],
            [-77.79,34.8,'Brunswick NPP','USA',2,1.9,'OPERATIONAL',''],
            [-80.27,32.14,'Virgil C. Summer','USA',1,0.97,'OPERATIONAL',''],
            [-81.12,33.33,'Oconee NPP','USA',3,2.6,'OPERATIONAL',''],
            [-88.07,44.32,'Point Beach NPP','USA',2,1.0,'OPERATIONAL',''],
            [-1.58,53.82,'Sellafield','UK',0,0,'DECOMMISSION','Largest nuclear site in Europe. Contamination risk.'],
            [-3.04,54.41,'Heysham NPP','UK',4,2.5,'OPERATIONAL','AGR reactors.'],
            [-4.72,53.41,'Wylfa NPP','UK',0,0,'SHUT DOWN','Magnox plant. Site for new Wylfa Newydd.'],
            [1.47,43.56,'Golfech NPP','France',2,2.7,'OPERATIONAL',''],
            [4.73,43.78,'Marcoule / Tricastin','France',4,3.6,'OPERATIONAL',''],
            [0.63,46.97,'Civaux NPP','France',2,2.7,'OPERATIONAL','Newest French plant.'],
            [6.02,47.33,'Bugey + Cruas NPP','France',4,2.6,'OPERATIONAL',''],
            [8.04,47.91,'Leibstadt NPP','Switzerland',1,1.2,'OPERATIONAL',''],
            [7.59,47.52,'Beznau NPP','Switzerland',2,0.73,'OPERATIONAL','Oldest operational NPP in world (1969).'],
            [-112.86, 33.38, 'Palo Verde', 'USA', 3, 3.9, 'OPERATIONAL', 'Largest US power plant by net generation.'],
            [-87.11, 34.70, 'Browns Ferry', 'USA', 3, 3.4, 'OPERATIONAL', 'Tennessee Valley Authority.'],
            [-76.26, 39.75, 'Peach Bottom', 'USA', 2, 2.7, 'OPERATIONAL', 'Operated by Constellation.'],
            [-76.69, 37.16, 'Surry NPP', 'USA', 2, 1.6, 'OPERATIONAL', 'Located in Virginia.'],
            [-84.78, 35.60, 'Watts Bar', 'USA', 2, 2.3, 'OPERATIONAL', 'Last US reactor online before Vogtle 3&4.'],
            [-120.85, 35.21, 'Diablo Canyon', 'USA', 2, 2.2, 'OPERATIONAL', 'Only remaining operational in California.'],
            [-88.22, 41.24, 'Braidwood', 'USA', 2, 2.3, 'OPERATIONAL', 'Illinois.'],
            [-88.66, 41.24, 'LaSalle', 'USA', 2, 2.2, 'OPERATIONAL', 'Illinois.'],
            [-75.58, 40.23, 'Limerick', 'USA', 2, 2.3, 'OPERATIONAL', 'Pennsylvania.'],
            [-72.16, 41.31, 'Millstone', 'USA', 2, 2.1, 'OPERATIONAL', 'Connecticut.'],
            [-85.08, 35.22, 'Sequoyah', 'USA', 2, 2.3, 'OPERATIONAL', 'Tennessee.'],
            [-76.14, 41.09, 'Susquehanna', 'USA', 2, 2.5, 'OPERATIONAL', 'Pennsylvania.'],
            [-75.53, 39.46, 'Salem / Hope Creek', 'USA', 3, 3.4, 'OPERATIONAL', 'New Jersey.'],
            [-81.76, 33.14, 'Vogtle NPP', 'USA', 4, 4.5, 'OPERATIONAL', 'Largest US NPP. Units 3 & 4 (AP1000) online.'],
            [-81.59, 44.32, 'Bruce NPP', 'Canada', 8, 6.4, 'OPERATIONAL', 'Largest operating NPP globally. CANDU.'],
            [-79.06, 43.81, 'Pickering', 'Canada', 6, 3.1, 'OPERATIONAL', 'Expected to operate until ~2026.'],
            [-78.71, 43.87, 'Darlington', 'Canada', 4, 3.5, 'OPERATIONAL', 'Undergoing refurbishment.'],
            [-66.86, 45.15, 'Point Lepreau', 'Canada', 1, 0.6, 'OPERATIONAL', 'New Brunswick.'],
            [2.13, 51.01, 'Gravelines', 'France', 6, 5.4, 'OPERATIONAL', 'Largest NPP in France.'],
            [0.63, 49.85, 'Paluel', 'France', 4, 5.3, 'OPERATIONAL', 'Second largest in France.'],
            [6.21, 49.41, 'Cattenom', 'France', 4, 5.2, 'OPERATIONAL', 'Grand Est region.'],
            [4.78, 50.09, 'Chooz', 'France', 2, 3.0, 'OPERATIONAL', 'N4 reactor design.'],
            [1.21, 49.97, 'Penly', 'France', 2, 2.6, 'OPERATIONAL', 'Located in Normandy.'],
            [3.51, 48.51, 'Nogent', 'France', 2, 2.6, 'OPERATIONAL', 'Grand Est.'],
            [2.87, 47.51, 'Belleville', 'France', 2, 2.6, 'OPERATIONAL', 'Centre-Val de Loire.'],
            [12.11, 57.25, 'Ringhals', 'Sweden', 2, 2.1, 'PARTIAL', 'Two reactors closed, two operational.'],
            [18.16, 60.40, 'Forsmark', 'Sweden', 3, 3.1, 'OPERATIONAL', 'Produces 1/6 of Swedens electricity.'],
            [16.66, 57.41, 'Oskarshamn', 'Sweden', 1, 1.4, 'PARTIAL', 'Only Unit 3 remains operational.'],
            [21.44, 61.23, 'Olkiluoto', 'Finland', 3, 3.3, 'OPERATIONAL', 'Unit 3 is Europes most powerful.'],
            [26.33, 60.36, 'Loviisa', 'Finland', 2, 1.0, 'OPERATIONAL', 'Soviet VVER design with Western control.'],
            [0.56, 41.20, 'Ascó', 'Spain', 2, 2.0, 'OPERATIONAL', 'Catalonia.'],
            [0.86, 40.95, 'Vandellòs', 'Spain', 1, 1.0, 'OPERATIONAL', 'Unit 1 closed, Unit 2 operational.'],
            [-5.69, 39.80, 'Almaraz', 'Spain', 2, 2.0, 'OPERATIONAL', 'Expected to close 2027-2028.'],
            [14.37, 49.18, 'Temelín', 'Czechia', 2, 2.1, 'OPERATIONAL', 'South Bohemian Region.'],
            [16.14, 49.08, 'Dukovany', 'Czechia', 4, 2.0, 'OPERATIONAL', 'VVER-440 reactors.'],
            [18.45, 48.26, 'Mochovce', 'Slovakia', 3, 1.4, 'OPERATIONAL', 'Unit 3 started 2023. Unit 4 building.'],
            [17.68, 48.49, 'Bohunice', 'Slovakia', 2, 1.0, 'OPERATIONAL', 'V-2 plant operational.'],
            [18.85, 46.57, 'Paks', 'Hungary', 4, 2.0, 'OPERATIONAL', 'Provides ~50% of Hungarys electricity.'],
            [15.52, 45.93, 'Krško', 'Slovenia', 1, 0.7, 'OPERATIONAL', 'Co-owned with Croatia.'],
            [4.25, 51.32, 'Doel', 'Belgium', 4, 2.9, 'OPERATIONAL', 'Scheduled for phase-out.'],
            [5.28, 50.53, 'Tihange', 'Belgium', 3, 3.0, 'OPERATIONAL', 'Along the Meuse river.'],
            [3.71, 51.43, 'Borssele', 'Netherlands', 1, 0.4, 'OPERATIONAL', 'Only commercial NPP in Netherlands.'],
            [1.62, 52.21, 'Sizewell B', 'UK', 1, 1.2, 'OPERATIONAL', 'Only PWR in the UK.'],
            [-2.40, 55.96, 'Torness', 'UK', 2, 1.2, 'OPERATIONAL', 'Advanced Gas-cooled Reactors (AGR).'],
            [-1.18, 54.63, 'Hartlepool', 'UK', 2, 1.2, 'OPERATIONAL', 'AGR design.'],
            [138.60, 37.42, 'Kashiwazaki-Kariwa', 'Japan', 7, 7.9, 'SUSPENDED', 'Offline since Fukushima.'],
            [129.87, 33.51, 'Genkai', 'Japan', 2, 2.2, 'PARTIAL', 'Units 3 & 4 restarted.'],
            [130.17, 31.83, 'Sendai', 'Japan', 2, 1.7, 'OPERATIONAL', 'First to restart post-Fukushima.'],
            [132.31, 33.48, 'Ikata', 'Japan', 1, 0.8, 'PARTIAL', 'Unit 3 operational.'],
            [136.72, 37.05, 'Shika', 'Japan', 2, 1.6, 'SUSPENDED', 'Offline since Fukushima.'],
            [140.51, 43.03, 'Tomari', 'Japan', 3, 1.9, 'SUSPENDED', 'Hokkaido. Offline.'],
            [120.25, 27.04, 'Ningde', 'China', 4, 4.0, 'OPERATIONAL', 'Fujian province.'],
            [119.44, 25.44, 'Fuqing', 'China', 6, 6.0, 'OPERATIONAL', 'First Hualong One reactor.'],
            [112.26, 21.71, 'Yangjiang', 'China', 6, 6.0, 'OPERATIONAL', 'Guangdong province.'],
            [121.38, 36.71, 'Haiyang', 'China', 2, 2.0, 'OPERATIONAL', 'Shandong. Also provides district heating.'],
            [112.98, 21.91, 'Taishan', 'China', 2, 3.3, 'OPERATIONAL', 'First EPR reactors to enter commercial op.'],
            [128.32, 36.85, 'Hanul/Shin-Hanul', 'South Korea', 8, 8.7, 'OPERATIONAL', 'One of largest plant clusters.'],
            [129.32, 35.32, 'Shin-Kori/Saeul', 'South Korea', 4, 4.2, 'OPERATIONAL', 'Includes APR1400 reactors.'],
        ];

        plants.forEach(([lon, lat, name, country, reactors, capacity, status, note]) => {
            const statusColors = { 'OPERATIONAL':'#00ff88', 'BUILDING':'#ffb000', 'SUSPENDED':'#ff8800', 'SHUT DOWN':'#888', 'DECOMMISSION':'#ff4444', 'SARCOPHAGUS':'#ff0000', 'OCCUPIED':'#ff0000', 'PARTIAL':'#00ff88', 'RESTARTING':'#00ffcc', 'RETIRING':'#ff8800' };
            const c = statusColors[status] || '#888';
            const el = document.createElement('div');
            el.style.cssText = `width:12px;height:12px;cursor:pointer;`;
            el.innerHTML = `<svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
                <polygon points="6,1 11,10 1,10" fill="${c}33" stroke="${c}" stroke-width="1.2"/>
                <circle cx="6" cy="7.5" r="1.5" fill="${c}"/>
            </svg>`;
            el.style.filter = `drop-shadow(0 0 3px ${c})`;
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '270px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:${c};margin:0 0 5px;border-bottom:1px solid ${c}44;padding-bottom:3px;">☢ ${name}</h3>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:5px;">
                    <div style="background:${c}11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">COUNTRY</div><div style="font-size:.65rem;">${country}</div></div>
                    <div style="background:${c}11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">REACTORS</div><div style="color:${c};">${reactors}</div></div>
                    <div style="background:${c}11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">CAPACITY</div><div style="font-size:.65rem;">${capacity} GW</div></div>
                </div>
                <div style="background:${c}22;border:1px solid ${c}55;padding:3px 7px;color:${c};margin-bottom:4px;font-size:.7rem;">${status}</div>
                <div style="font-size:.65rem;opacity:.75;line-height:1.4;">${note}</div>
                <div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: IAEA PRIS / WNA 2024</div>
                </div>`);
            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat]).setPopup(popup);
            nuclearMarkers.push(m);
            if (toggles.nuclear) m.addTo(map);
        });

        // Nuclear Arsenal — 9 states
        const arsenals = [
            [-77.04,38.89,'USA',5244,'Active: 1,670 deployed. Trident, B61, Minuteman III. Reducing under New START.'],
            [37.61,55.75,'Russia',5889,'Largest stockpile. ~1,674 deployed. Sarmat, Kinzhal, Poseidon.'],
            [116.39,39.91,'China',500,'Rapidly expanding. Estimated 500-700 by 2030.'],
            [-3.44,55.38,'UK',225,'Trident SLBM. Increasing cap to 260 (2021 review).'],
            [2.35,48.85,'France',290,'Independent deterrent. ASMP-A cruise + M51 SLBM.'],
            [72.88,19.08,'India',172,'Growing program. Agni-V ICBM capability.'],
            [74.35,30.37,'Pakistan',170,'Rival program. Ghauri/Shaheen missiles. F-16 nuclear role.'],
            [35.22,31.77,'Israel',90,'Undeclared. Jericho III ICBM. Dimona facility.'],
            [125.73,39.03,'North Korea',50,'Estimated 40-60. ICBM Hwasong-17 can reach continental USA.'],
        ];
        arsenals.forEach(([lon, lat, country, warheads, note]) => {
            const el = document.createElement('div');
            el.style.cssText = 'width:18px;height:18px;cursor:pointer;';
            el.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="8" fill="rgba(255,0,0,0.1)" stroke="#ff0000" stroke-width="1.5"/>
                <text x="9" y="13" text-anchor="middle" font-size="10" fill="#ff0000">☢</text>
            </svg>`;
            el.style.filter = 'drop-shadow(0 0 5px #ff0000)';
            const popup = new maplibregl.Popup({ offset: 10, maxWidth: '260px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:#ff0000;margin:0 0 5px;border-bottom:1px solid #ff000044;padding-bottom:3px;">☢ ${country} — NUCLEAR ARSENAL</h3>
                <div style="background:rgba(255,0,0,.08);border:1px solid rgba(255,0,0,.3);padding:6px 8px;margin-bottom:5px;">
                    <div style="font-size:.6rem;opacity:.5;">ESTIMATED WARHEADS</div>
                    <div style="color:#ff0000;font-size:1.3rem;font-weight:bold;">${warheads.toLocaleString()}</div>
                </div>
                <div style="font-size:.65rem;opacity:.75;line-height:1.4;">${note}</div>
                <div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: SIPRI Yearbook 2024</div>
                </div>`);
            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([lon, lat]).setPopup(popup);
            nukeArsenalMarkers.push(m);
            if (toggles.nukes) m.addTo(map);
        });
    };

    // ============================================================
    // CONFLICT ZONES (curated 2025 data — no API key needed)
    // ============================================================
    const conflictMarkers = [];
    const CONFLICTS = [
        {
            name: 'Ukraine — Russia War', lat: 48.5, lon: 37.5, severity: 'CRITICAL',
            type: 'Interstate War', since: 2022,
            parties: [['Russia', 'Aggressor'], ['Ukraine', 'Defender']],
            support: 'UA: NATO/EU aid. RU: Iran, DPRK, Belarus.',
            casualties: '~500,000–700,000 (KIA + WIA, both sides)',
            displaced: '~8M refugees, 5M internally displaced',
            status: 'ACTIVE — Frontline mostly static, drone war escalating',
            note: 'Largest land war in Europe since WWII. Started with full invasion Feb 24, 2022.'
        },
        {
            name: 'Gaza — Israel Conflict', lat: 31.35, lon: 34.30, severity: 'CRITICAL',
            type: 'Military Operation / Urban Warfare', since: 2023,
            parties: [['Israel (IDF)', 'Military operation'], ['Hamas', 'Gaza de-facto govt']],
            support: 'IL: US military aid. Hamas: Iran, Hezbollah.',
            casualties: '>48,000 Palestinian dead (UN est.), ~1,200 Israeli on Oct 7',
            displaced: '~1.9M Gazans (90% of population)',
            status: 'ACTIVE — Ongoing IDF operations, humanitarian crisis',
            note: 'Triggered by Hamas attack on Oct 7, 2023. Ceasefire negotiations ongoing.'
        },
        {
            name: 'West Bank Escalation', lat: 32.1, lon: 35.2, severity: 'HIGH',
            type: 'Occupation / Armed Clashes', since: 1967,
            parties: [['Israel (settlers/IDF)', 'Occupying force'], ['Palestinian groups', 'Resistance']],
            support: 'US veto in UNSC. PA security forces partially cooperate with IDF.',
            casualties: '>700 Palestinians killed in 2024 (highest since 2nd Intifada)',
            displaced: 'Tens of thousands in recent raids (Jenin, Tulkarm)',
            status: 'ESCALATING — Large-scale IDF raids ongoing 2025',
            note: 'Occupation since 1967. Settler violence and IDF incursions dramatically increased post-Oct 7.'
        },
        {
            name: 'Sudan — Civil War', lat: 15.5, lon: 32.5, severity: 'CRITICAL',
            type: 'Civil War', since: 2023,
            parties: [['SAF (Army)', 'Official military'], ['RSF (Rapid Support Forces)', 'Paramilitary']],
            support: 'SAF: Egypt, Eritrea. RSF: UAE, Wagner/Russia.',
            casualties: '>150,000 dead, >9M displaced',
            displaced: 'Largest displacement crisis in the world (2024)',
            status: 'ACTIVE — RSF controls most of Darfur, fighting in Khartoum',
            note: 'Broke out Apr 15, 2023. Power struggle between Gen. Burhan (SAF) and Gen. Dagalo (RSF).'
        },
        {
            name: 'Myanmar — Civil War', lat: 20.0, lon: 96.5, severity: 'CRITICAL',
            type: 'Civil War / Junta vs. Resistance', since: 2021,
            parties: [['Military Junta (SAC)', 'Coup govt since Feb 2021'], ['PDF + EAOs (30+ groups)', 'Pro-democracy resistance']],
            support: 'Junta: China, Russia. PDF: limited Western support.',
            casualties: '>50,000 dead, 3M+ displaced since coup',
            displaced: '~3.2M internally displaced',
            status: 'ACTIVE — Junta losing territory rapidly since Oct 2023 offensive',
            note: 'Military coup Feb 1, 2021. Operation 1027 (Oct 2023) saw major rebel advances.'
        },
        {
            name: 'Ethiopia — Amhara & Oromia', lat: 10.5, lon: 38.5, severity: 'HIGH',
            type: 'Internal Armed Conflict', since: 2018,
            parties: [['ENDF (Ethiopian Army)', 'Federal government'], ['FANO / OLA', 'Amhara & Oromo armed groups']],
            support: 'ENDF: Eritrea (limited). FANO/OLA: diaspora funding.',
            casualties: 'Thousands dead; Tigray war (ended 2022): ~300,000-500,000',
            displaced: '>4M total (all Ethiopian conflicts combined)',
            status: 'ACTIVE — FANO controls parts of Amhara; OLA active in Oromia',
            note: 'Post-Tigray peace deal (Nov 2022) new conflicts erupted in Amhara and Oromia regions.'
        },
        {
            name: 'Somalia — Al-Shabaab', lat: 5.0, lon: 45.5, severity: 'HIGH',
            type: 'Islamist Insurgency', since: 2006,
            parties: [['Somali Federal Govt + ATMIS', 'UN-backed government'], ['Al-Shabaab (AQ-affiliate)', 'Controls large rural areas']],
            support: 'Govt: AU Mission (ATMIS), US airstrikes. AS: local taxation.',
            casualties: '~500,000+ since 2007 (direct + famine-related)',
            displaced: '~3.8M IDPs in Somalia',
            status: 'ACTIVE — AS controls ~40% of territory, regular attacks on cities',
            note: 'Al-Shabaab affiliated with Al-Qaeda since 2012. Controls rural areas, taxes population.'
        },
        {
            name: 'Yemen — Civil War', lat: 15.5, lon: 44.2, severity: 'HIGH',
            type: 'Civil War / Proxy Conflict', since: 2014,
            parties: [['Houthis (Ansar Allah)', 'Controls Sanaa + Red Sea coast'], ['Saudi-led Coalition + IRG', 'UN-recognised govt']],
            support: 'Houthis: Iran. Coalition: US/UK air support.',
            casualties: '>150,000 combat dead; 377,000 total (war-related, UN)',
            displaced: '~4.5M IDPs; world\'s worst humanitarian crisis (2021)',
            status: 'CEASEFIRE (fragile) — Houthis attacking Red Sea since Nov 2023',
            note: 'Houthi takeover 2014-15 sparked Saudi intervention. Houthis now attacking global shipping in solidarity with Gaza.'
        },
        {
            name: 'Red Sea — Houthi Maritime War', lat: 15.0, lon: 42.5, severity: 'HIGH',
            type: 'Maritime / Asymmetric Conflict', since: 2023,
            parties: [['Houthis (Yemen)', 'Attacking commercial + military ships'], ['US/UK + Coalition', 'Defensive strikes on Houthi positions']],
            support: 'Houthis: Iranian missiles, drones. Coalition: US carrier groups.',
            casualties: '4 seafarers killed; multiple ships sunk',
            displaced: 'N/A — Maritime conflict; shipping rerouted around Africa (+14 days)',
            status: 'ACTIVE — Ongoing attacks on Red Sea shipping since Nov 19, 2023',
            note: 'Houthis claim attacks are pro-Palestine. Global trade severely disrupted. Suez Canal traffic -50%.'
        },
        {
            name: 'DR Congo — Eastern Conflict', lat: -1.5, lon: 29.0, severity: 'CRITICAL',
            type: 'Civil War / Regional Proxy', since: 1996,
            parties: [['FARDC + FDLR', 'DRC government army'], ['M23 (Rwanda-backed)', 'Rebel group']],
            support: 'M23: Rwanda (denied). FARDC: MONUSCO (withdrawing).',
            casualties: '>6M dead (since 1996); ongoing thousands per year',
            displaced: '~7M IDPs — largest in Africa',
            status: 'CRITICAL — M23 captured Goma (Jan 2025), advancing on Bukavu',
            note: 'World\'s most deadly ongoing conflict. M23 captures Goma, DRC\'s second city, Jan 2025.'
        },
        {
            name: 'Sahel — Mali & Burkina Faso', lat: 14.5, lon: -3.5, severity: 'HIGH',
            type: 'Jihadist Insurgency', since: 2012,
            parties: [['Juntas (Mali + BF)', 'Military governments (post-coup)'], ['JNIM / ISGS', 'Al-Qaeda & IS affiliates']],
            support: 'Juntas: Wagner/Russia, expelled French forces. JNIM: local recruits.',
            casualties: '>15,000 civilians dead in Sahel 2023-2024',
            displaced: '~3M across Mali, BF, Niger',
            status: 'ACTIVE — JNIM controls large areas; mass atrocities ongoing',
            note: 'Post-coup juntas expelled France, invited Wagner. Jihadist territory expanded despite Russian presence.'
        },
        {
            name: 'Niger — Terrorism & Coup', lat: 16.0, lon: 8.0, severity: 'MODERATE',
            type: 'Jihadist Insurgency + Political Crisis', since: 2015,
            parties: [['Military Junta (CNSP)', 'Post-July 2023 coup govt'], ['ISGS + Ansarul Islam', 'IS & AQ affiliates']],
            support: 'Junta: Mali, BF, Russia. West expelled after coup.',
            casualties: '>2,000 civilians/military dead 2023',
            displaced: '~350,000 IDPs',
            status: 'ACTIVE — Junta consolidating power, jihadists expanding',
            note: 'Military coup July 26, 2023. France and US lost bases. IS expanding in Tillabéri region.'
        },
        {
            name: 'Haiti — Gang Warfare', lat: 18.7, lon: -72.3, severity: 'CRITICAL',
            type: 'Criminal / Gang Warfare', since: 2021,
            parties: [['G9 Family / Viv Ansanm coalition', '~200 armed groups, ~80% of Port-au-Prince'], ['Haitian National Police + MSS (Kenya-led)', 'Collapsing state security']],
            support: 'Gangs: diaspora money, weapon trafficking. MSS: US-funded, Kenya-led.',
            casualties: '>5,600 killed in 2024 (UN); >2,000 in Q1 2024 alone',
            displaced: '~700,000 IDPs in Haiti',
            status: 'CRITICAL — State near-collapse; PM resigned Mar 2024',
            note: 'Accelerated after PM Moïse assassination 2021. Gang leader Barbecue controls capital approaches.'
        },
        {
            name: 'Mexico — Cartel Wars', lat: 25.0, lon: -107.0, severity: 'HIGH',
            type: 'Criminal / Narco Conflict', since: 2006,
            parties: [['CJNG (Jalisco Cartel)', 'Expanding paramilitary cartel'], ['Sinaloa Cartel (split)', 'Los Chapitos vs. Mayos faction']],
            support: 'Cartels: drug revenue, US weapons. Govt: US DEA support.',
            casualties: '>450,000 murdered since 2006; ~35,000/yr currently',
            displaced: '>400,000 internally displaced by cartel violence',
            status: 'ACTIVE — Sinaloa civil war since Aug 2024; CJNG expanding',
            note: 'Deadliest non-war conflict globally. Sinaloa internal split Aug 2024: Chapitos vs. Ismael Zambada faction.'
        },
        {
            name: 'Iraq — IS Remnants', lat: 34.0, lon: 43.0, severity: 'MODERATE',
            type: 'Counter-Insurgency', since: 2013,
            parties: [['Iraqi Security Forces + PMF', 'Government + Iran-backed militia'], ['Islamic State (IS)', 'Surviving sleeper cells']],
            support: 'ISF: US air support, Iranian PMF. IS: self-financed cells.',
            casualties: '>200,000 dead (IS peak 2014-2017); ongoing ~500/yr',
            displaced: 'Most of 6M Iraqi IDPs returned; ~1.2M still displaced',
            status: 'LOW INTENSITY — IS cells active in Kirkuk, Diyala, Anbar deserts',
            note: 'IS "caliphate" defeated 2019, but cells persist. 1-2 attacks/week. Iran-backed PMF tensions rising.'
        },
        {
            name: 'Syria — Post-War Transition', lat: 35.5, lon: 38.5, severity: 'HIGH',
            type: 'Civil War ? Transition', since: 2011,
            parties: [['HTS (Hayat Tahrir al-Sham)', 'Controls most of Syria since Dec 2024'], ['SDF (Kurds)', 'NE Syria'], ['SNA + Turkey', 'NW border zone']],
            support: 'HTS: Turkey (ambivalent). SDF: US. IS: self-financed.',
            casualties: '>580,000 dead since 2011 (SOHR)',
            displaced: '~7M refugees abroad, 7M+ IDPs — largest refugee crisis before Ukraine',
            status: 'TRANSITION — Assad fell Dec 8, 2024; HTS forming new govt',
            note: 'Assad regime collapsed Dec 8, 2024 after rebel offensive. HTS (ex-al-Nusra) now governing.'
        },
        {
            name: 'Lebanon — Post-War Fragility', lat: 33.6, lon: 35.5, severity: 'HIGH',
            type: 'Post-Conflict / Political Crisis', since: 2023,
            parties: [['Israel', 'Military operation in S. Lebanon'], ['Hezbollah (Iran-backed)', 'Dominant armed group']],
            support: 'Hezbollah: Iran (weapons, money). Israel: US military aid.',
            casualties: '>4,000 dead in Lebanon-Israel fighting, 2024; ~1,200 Hezbollah fighters',
            displaced: '~1.2M displaced in Lebanon during conflict',
            status: 'CEASEFIRE (Nov 2024) — Fragile; Hezbollah rebuilt; IDF partial withdrawal',
            note: 'Full escalation Jun-Nov 2024. Ceasefire Nov 27, 2024. Hezbollah severely weakened (Nasrallah killed).'
        },
        {
            name: 'Pakistan — TTP Insurgency', lat: 33.0, lon: 70.5, severity: 'MODERATE',
            type: 'Islamist Insurgency', since: 2007,
            parties: [['Pakistan Army', 'Federal security forces'], ['TTP (Tehrik-i-Taliban)', 'Taliban-linked insurgency']],
            support: 'Pakistan: Chinese military cooperation. TTP: Afghan Taliban support.',
            casualties: '>80,000 dead (2007-present, all causes)',
            displaced: '>500,000 IDPs in KPK/FATA regions',
            status: 'ESCALATING — TTP attacks surged 70% since Afghan Taliban takeover 2021',
            note: 'TTP attacks dramatically increased after Afghan Taliban return to power in 2021. Safe haven in Afghanistan.'
        },
        {
            name: 'Nagorno-Karabakh Aftermath', lat: 40.2, lon: 46.8, severity: 'MODERATE',
            type: 'Post-Conflict Ethnic Cleansing / Tensions', since: 1988,
            parties: [['Azerbaijan', 'Retook NKR Sept 2023'], ['Armenia', 'Ceded NKR; border demarcation ongoing']],
            support: 'Azerbaijan: Turkey, Israel (weapons). Armenia: Russia (failed to protect).',
            casualties: '~7,000 dead in 2020 war; ~200 in Sept 2023 operation',
            displaced: '~100,000 ethnic Armenians fled NKR in Sept 2023 (full depopulation)',
            status: 'NO ACTIVE FIGHTING — Peace treaty negotiations ongoing 2025',
            note: 'Azerbaijan\'s 24h "anti-terror" op (Sept 19-20, 2023) ended NKR existence. All Armenians fled.'
        },
        {
            name: 'Libya — Rival Governments', lat: 29.0, lon: 18.0, severity: 'MODERATE',
            type: 'Political-Military Standoff', since: 2011,
            parties: [['GNU (Tripoli, West)', 'UN-recognised govt of Dbeibah'], ['LNA/GECOL (Benghazi, East)', 'Haftar\'s rival military command']],
            support: 'GNU: Turkey troops. LNA: UAE, Russia/Wagner, Egypt.',
            casualties: '>25,000 dead since 2011 civil war',
            displaced: '>200,000 Libyans displaced; major migrant transit country',
            status: 'FROZEN CONFLICT — Ceasefire Oct 2020; sporadic clashes; oil disputes',
            note: 'Split since Gaddafi fall 2011. Two rival govts. Occasional fighting despite 2020 ceasefire.'
        },
        {
            name: 'Iran — US/Israel War 2025', lat: 32.5, lon: 51.5, severity: 'CRITICAL',
            type: 'Interstate War / Air Campaign', since: 2025,
            parties: [['USA + Israel', 'Strikes on nuclear/IRGC sites'], ['Iran', 'Missile retaliation, Hormuz disruption']],
            support: 'US: Gulf bases, F-35s. Iran: Russia, China (limited).',
            casualties: 'Hundreds military; US bases attacked in Iraq/UAE',
            displaced: 'Limited ground displacement; oil crisis ($120+/bbl)',
            status: 'ACTIVE — Air/missile war; Hormuz partially blocked',
            note: 'US struck nuclear sites after 90% enrichment confirmed. Iran retaliated on US bases. Strait of Hormuz disrupted.'
        },
        {
            name: 'Iran — Israel Proxy War', lat: 33.5, lon: 43.5, severity: 'CRITICAL',
            type: 'Regional Proxy / Direct Clash', since: 2019,
            parties: [['Israel (IDF)', 'Strikes + assassinations'], ['Iran (IRGC)', 'Proxies + direct missiles']],
            support: 'Israel: US, Iron Dome. Iran: Hezbollah, Houthis, PMF.',
            casualties: 'Thousands killed across multiple fronts since Oct 2023',
            displaced: 'N/A — multi-front proxy war',
            status: 'ACTIVE — Direct exchanges since Apr 2024; linked to 2025 war',
            note: 'Iran fired 300+ missiles at Israel (Apr 2024). Proxy network weakened but active.'
        },
        {
            name: 'Strait of Hormuz Crisis', lat: 26.0, lon: 56.0, severity: 'CRITICAL',
            type: 'Naval / Air-Sea Confrontation', since: 2019,
            parties: [['USA (CENTCOM)', 'Carrier groups, escorts'], ['IRGC Navy', 'Mines, missile boats']],
            support: 'USA: Gulf states. Iran: asymmetric warfare.',
            casualties: 'Naval skirmishes; tanker seizures',
            displaced: 'N/A — 20% of global oil transits here',
            status: 'ACTIVE — Tanker escorts; mine-laying ops',
            note: 'Escalated to direct conflict 2025. US Navy escorting oil tankers through strait.'
        }
    ];

    const CONFLICT_COLORS = { CRITICAL: '#ff0000', HIGH: '#ff6600', MODERATE: '#ffb000' };

    const initConflictZones = () => {
        const currentYear = new Date().getFullYear();
        CONFLICTS.forEach(c => {
            const col = CONFLICT_COLORS[c.severity] || '#ff6600';
            const duration = currentYear - c.since;
            const el = document.createElement('div');
            el.style.cssText = 'width:22px;height:22px;cursor:pointer;';
            el.innerHTML = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
                <circle cx="11" cy="11" r="9" fill="none" stroke="${col}" stroke-width="1.5" opacity="0.9"/>
                <line x1="0" y1="11" x2="22" y2="11" stroke="${col}" stroke-width="1"/>
                <line x1="11" y1="0" x2="11" y2="22" stroke="${col}" stroke-width="1"/>
                <circle cx="11" cy="11" r="2.5" fill="${col}" opacity="0.8"/>
            </svg>`;
            el.style.filter = `drop-shadow(0 0 4px ${col})`;

            const partiesHtml = c.parties.map(([name, role]) =>
                `<div style="background:rgba(255,0,0,.05);padding:3px 7px;border-left:2px solid ${col}55;">
                    <div style="color:${col};font-size:.72rem;">${name}</div>
                    <div style="opacity:.55;font-size:.62rem;">${role}</div>
                </div>`
            ).join('');

            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([c.lon, c.lat]);
                
            el.addEventListener('click', () => {
                window.openBriefing({
                    id: `CONF-${c.name.replace(/\s+/g,'-').toUpperCase()}`,
                    title: c.name,
                    severity: c.severity,
                    what: `<strong>${c.type}</strong><br>${c.status}<br><br><strong>Combatants:</strong><br>${c.parties.map(p=>`â• ${p[0]} (${p[1]})`).join('<br>')}`,
                    why: `<strong>Casualties:</strong> ${c.casualties}<br><strong>Displaced:</strong> ${c.displaced}<br><br>${c.note}`,
                    time: `Ongoing since ${c.since} (${duration} yrs)`,
                    source: 'ACLED / SIPRI / UN OCHA',
                    location: [c.lon, c.lat],
                    relatedLayers: [
                        { label: 'View Power Infrastructure', layerId: 'pipelines' },
                        { label: 'View Internet Cables', layerId: 'cables' }
                    ]
                });
            });
            conflictMarkers.push(m);
            if (toggles.conflicts) m.addTo(map);
        });
        setStatus(currentLang === 'de' ? 'KONFLIKTZONE-DATENBANK GELADEN.' : 'CONFLICT ZONE DATABASE LOADED.');
    };

    document.getElementById('toggle-conflicts')?.addEventListener('change', (e) => {
        toggles.conflicts = e.target.checked;
        if (toggles.conflicts && conflictMarkers.length === 0) initConflictZones();
        conflictMarkers.forEach(m => toggles.conflicts ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-regimes')?.addEventListener('change', (e) => {
        toggles.regimes = e.target.checked;
        if (toggles.regimes && regimeMarkers.length === 0) initRegimeMap();
        regimeMarkers.forEach(m => toggles.regimes ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-blocs')?.addEventListener('change', (e) => {
        toggles.blocs = e.target.checked;
        if (toggles.blocs && blocMarkers.length === 0) initGeoBlocs();
        blocMarkers.forEach(m => toggles.blocs ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-cables')?.addEventListener('change', (e) => {
        toggles.cables = e.target.checked;
        if (toggles.cables && !map.getSource('cables-src')) initUnderseaCables();
        if (map.getLayer('cables-layer'))
            map.setLayoutProperty('cables-layer', 'visibility', toggles.cables ? 'visible' : 'none');
    });

    document.getElementById('toggle-datacenters')?.addEventListener('change', (e) => {
        toggles.datacenters = e.target.checked;
        if (toggles.datacenters && dcMarkers.length === 0) initDataCenters();
        dcMarkers.forEach(m => toggles.datacenters ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-nuclear')?.addEventListener('change', (e) => {
        toggles.nuclear = e.target.checked;
        if (toggles.nuclear && nuclearMarkers.length === 0) initNuclearLayer();
        nuclearMarkers.forEach(m => toggles.nuclear ? m.addTo(map) : m.remove());
    });

    // MISSING TOGGLES & REAL-TIME TRACKING REPAIRS
    const getYesterdaysDateForGIBS = () => {
        const d = new Date();
        d.setDate(d.getDate() - 2); 
        return d.toISOString().split('T')[0];
    };

    // Ships toggle removed — no free keyless AIS API available

    // Flights toggle removed — layer removed due to API limitations
    
    document.getElementById('toggle-starlink')?.addEventListener('change', (e) => {
        toggles.starlink = e.target.checked;
        if (map.getLayer('starlink-layer')) map.setLayoutProperty('starlink-layer', 'visibility', toggles.starlink ? 'visible' : 'none');
    });

    document.getElementById('toggle-earthquakes')?.addEventListener('change', (e) => {
        toggles.earthquakes = e.target.checked;
        if (map.getLayer('earthquakes-core')) {
            map.setLayoutProperty('earthquakes-core', 'visibility', toggles.earthquakes ? 'visible' : 'none');
            map.setLayoutProperty('earthquakes-ring', 'visibility', toggles.earthquakes ? 'visible' : 'none');
            if (map.getLayer('earthquakes-tsunami-ring')) map.setLayoutProperty('earthquakes-tsunami-ring', 'visibility', toggles.earthquakes ? 'visible' : 'none');
            if (map.getLayer('earthquakes-pulse')) map.setLayoutProperty('earthquakes-pulse', 'visibility', toggles.earthquakes ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-fires')?.addEventListener('change', (e) => {
        toggles.fires = e.target.checked;
        if (toggles.fires && !window.__firesLoaded && window.__loadFires) window.__loadFires();
        const firesVis = toggles.fires ? 'visible' : 'none';
        if (map.getLayer('fires-layer')) map.setLayoutProperty('fires-layer', 'visibility', firesVis);
    });

    document.getElementById('toggle-terminator')?.addEventListener('change', (e) => {
        toggles.terminator = e.target.checked;
        if (map.getLayer('terminator-layer')) map.setLayoutProperty('terminator-layer', 'visibility', toggles.terminator ? 'visible' : 'none');
    });

    // ── WEBCAM CAMERA CATALOG ─────────────────────────────
    // Each camera: { id, title, location, country, lat, lon, src, srcType, provider, tags }
    // srcType: 'foto-webcam' = real snapshot from foto-webcam.eu (verified working)
    // All cameras use foto-webcam.eu real snapshots (verified cross-origin working)
    const WEBCAM_CATALOG = [
        // ── Curated foto-webcam.eu cameras — verified working real snapshots ──
        { id: 'zugspitze', title: 'Zugspitze Summit', location: 'Garmisch-Partenkirchen', country: 'DEU',
          lat: 47.421, lon: 10.985, src: 'zugspitze', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['alps', 'mountain', 'germany'] },
        { id: 'feldberg-ts', title: 'Großer Feldberg', location: 'Taunus / Wiesbaden Area', country: 'DEU',
          lat: 50.222, lon: 8.446, src: 'feldberg-ts', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['taunus', 'hessen', 'wiesbaden'] },
        { id: 'nebelhorn', title: 'Nebelhorn Panorama', location: 'Oberstdorf, Allgäu Alps', country: 'DEU',
          lat: 47.408, lon: 10.343, src: 'nebelhorn', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['alps', 'panorama', 'germany'] },
        { id: 'muenchen', title: 'Munich Panorama', location: 'Munich, Bavaria', country: 'DEU',
          lat: 48.137, lon: 11.576, src: 'muenchen', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['city', 'bavaria', 'germany'] },
        { id: 'innsbruck', title: 'Innsbruck Seegrube', location: 'Innsbruck, Austria', country: 'AUT',
          lat: 47.306, lon: 11.388, src: 'innsbruck', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['city', 'alps', 'austria'] },
        { id: 'wien', title: 'Vienna Skyline', location: 'Wien Donaustadt', country: 'AUT',
          lat: 48.236, lon: 16.441, src: 'wien', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['city', 'austria'] },
        { id: 'salzburg', title: 'Salzburg Panorama', location: 'Hochstaufen View', country: 'AUT',
          lat: 47.760, lon: 12.873, src: 'salzburg', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['city', 'alps', 'austria'] },
        { id: 'sonnblick', title: 'Sonnblick Observatory', location: '3106m, Hohe Tauern', country: 'AUT',
          lat: 47.054, lon: 12.957, src: 'sonnblick', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['alps', 'science', 'austria'] },
        { id: 'konkordiahuette', title: 'Konkordiahütte', location: 'Aletsch Glacier, Switzerland', country: 'CHE',
          lat: 46.495, lon: 8.041, src: 'konkordiahuette', srcType: 'foto-webcam',
          provider: 'foto-webcam.eu', tags: ['alps', 'glacier', 'switzerland'] },
    ];


    let webcamRefreshTimers = [];

    const buildWebcamPopup = (cam) => {
        if (cam.srcType === 'foto-webcam') {
            // Real snapshot from foto-webcam.eu — verified working cross-origin
            const imgUrl = `https://www.foto-webcam.eu/webcam/${cam.src}/current/640.jpg`;
            const thumbId = `wcam-img-${cam.id}`;
            return `
                <div style="font-family:'Share Tech Mono',monospace; width:320px; background:rgba(0,10,20,0.97); border:1px solid #00d4ff; padding:0; border-radius:4px; overflow:hidden;">
                    <div style="padding:6px 10px; border-bottom:1px solid rgba(0,212,255,0.2); display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#00d4ff; font-size:0.72rem; letter-spacing:1px;"><i class="fa-solid fa-video" style="margin-right:4px;"></i>${escHtml(cam.title)}</span>
                        <span style="font-size:0.5rem; color:#0f0; letter-spacing:1px;">● LIVE SNAPSHOT</span>
                    </div>
                    <div style="position:relative; width:100%; background:#000; line-height:0;">
                        <img id="${thumbId}" src="${imgUrl}" style="width:100%; height:auto; display:block; min-height:140px; object-fit:cover;"
                             alt="${escHtml(cam.title)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                        <div style="display:none; width:100%; height:160px; align-items:center; justify-content:center; flex-direction:column; background:rgba(0,0,0,0.9);">
                            <i class="fa-solid fa-signal" style="color:#ff3344; font-size:1.5rem; margin-bottom:8px;"></i>
                            <span style="color:#ff3344; font-size:0.7rem; letter-spacing:1px;">SIGNAL LOST</span>
                        </div>
                    </div>
                    <div style="padding:5px 10px; display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.06);">
                        <span style="font-size:0.5rem; color:rgba(255,255,255,0.35);">${escHtml(cam.location)}</span>
                        <a href="https://www.foto-webcam.eu/webcam/${cam.src}/" target="_blank" rel="noopener" style="font-size:0.48rem; color:#00d4ff; text-decoration:none; letter-spacing:1px;">FULL VIEW ↗</a>
                    </div>
                    <div style="padding:3px 10px 5px; font-size:0.42rem; color:rgba(255,255,255,0.2); letter-spacing:1px;">
                        SOURCE: ${escHtml(cam.provider)} · AUTO-REFRESH 60s · <span style="color:rgba(0,212,255,0.4);">foto-webcam.eu</span>
                    </div>
                </div>`;
        }
        return '<div style="padding:10px;color:#888;font-size:0.7rem;">No feed available</div>';
    };

    const initWebcams = () => {
        const camCount = WEBCAM_CATALOG.length;

        WEBCAM_CATALOG.forEach(cam => {
            const el = document.createElement('div');
            const markerColor = 'rgba(0,255,136,0.85)';
            const glowColor = 'rgba(0,255,136,0.6)';
            el.className = 'marker-webcam';
            el.style.cssText = `width:20px;height:20px;cursor:pointer;`;
            el.innerHTML = `<div style="width:20px;height:20px;background:${markerColor};border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;box-shadow:0 0 10px ${glowColor};transition:transform 0.2s;"><i class="fa-solid fa-video" style="font-size:8px;"></i></div>`;
            const inner = el.firstElementChild;
            el.onmouseenter = () => { inner.style.transform = 'scale(1.3)'; };
            el.onmouseleave = () => { inner.style.transform = 'scale(1)'; };

            const popup = new maplibregl.Popup({ offset: 14, maxWidth: '340px', closeButton: true })
                .setHTML(buildWebcamPopup(cam));

            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([cam.lon, cam.lat])
                .setPopup(popup);

            webcamMarkers.push(m);
            if (toggles.webcams) m.addTo(map);
        });

        // Auto-refresh foto-webcam snapshots every 60s
        const refreshInterval = setInterval(() => {
            if (!toggles.webcams) return;
            WEBCAM_CATALOG.filter(c => c.srcType === 'foto-webcam').forEach(cam => {
                const img = document.getElementById(`wcam-img-${cam.id}`);
                if (img) {
                    img.src = `https://www.foto-webcam.eu/webcam/${cam.src}/current/640.jpg?t=${Date.now()}`;
                }
            });
        }, 60000);
        webcamRefreshTimers.push(refreshInterval);

        if (window.updateLayerStatus) updateLayerStatus('webcams', 'LIVE', `${camCount} live snapshot cameras`);
        setStatus(currentLang === 'de' ? `WEBCAMS ONLINE: ${camCount} Live-Kameras (foto-webcam.eu)` : `WEBCAMS ONLINE: ${camCount} live cameras (foto-webcam.eu)`);
    };

    // ══════════════════════════════════════════════════════════════════════
    // KAMERA-RASTER — indexgestützt, zoomgesteuert                    (V2.6)
    // ══════════════════════════════════════════════════════════════════════
    //
    // Die neun kuratierten foto-webcam.eu-Kameras oben bleiben unverändert:
    // Panoramen, die man auch aus der Ferne sehen will. Hier kommt die Masse
    // dazu — knapp 5.000 öffentliche Verkehrskameras aus London, Austin und
    // Kalifornien.
    //
    // Drei Regeln halten das beherrschbar:
    //
    //  1. NICHTS VOR DER STADTEBENE. Unterhalb CAM_MIN_ZOOM wird kein einziger
    //     Marker gezeichnet. 5.000 Punkte auf einer Weltkarte sind kein
    //     Informationsgewinn, sondern Konfetti.
    //  2. NUR DER AUSSCHNITT, gedeckelt auf CAM_MAX_MARKERS. Der Index bleibt
    //     vollständig im Speicher — er ist Daten, keine DOM-Knoten, und kostet
    //     die Karte nichts.
    //  3. EIN POPUP, nicht eines je Kamera. Das Bild wird beim Klick geladen,
    //     nie auf Vorrat.
    //
    // Der Index (data/cameras.json) entsteht zur Bauzeit über
    // scripts/build-camera-index.mjs und wird träge geladen: wer den Layer nie
    // einschaltet und nie nach einer Kamera sucht, lädt ihn nie.
    const CAM_MIN_ZOOM = 11;        // Stadtebene — Straßenzüge unterscheidbar
    const CAM_MAX_MARKERS = 300;    // Obergrenze je Ausschnitt
    const CAM_REFRESH_MS = 60000;

    /** Bild-URL-Vorlagen. MUSS mit IMAGE_URL in scripts/build-camera-index.mjs übereinstimmen. */
    const CAM_IMAGE_URL = {
        t: (id) => `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${id}.jpg`,
        a: (id) => `https://cctv.austinmobility.io/image/${id}.jpg`,
    };
    const CAM_SOURCE_LABEL = { t: 'TfL Open Data', a: 'City of Austin', c: 'Caltrans' };

    let camIndex = null;            // { generated, attribution, cameras: [...] }
    let camIndexPromise = null;
    const camMarkers = new Map();   // "quelle:id" -> maplibregl.Marker
    let camPopup = null;
    let camGridBound = false;

    /** Zeile -> Bild-URL. Caltrans bringt sie mit (Feld 5), der Rest leitet sie ab. */
    const camImageUrl = (c) => c[5] || CAM_IMAGE_URL[c[0]]?.(c[1]) || null;
    const camKey = (c) => `${c[0]}:${c[1]}`;

    /**
     * Lädt den Index einmal. Mehrfachaufrufe teilen sich dieselbe Zusage, damit
     * gleichzeitiges "Layer an" und "Suche tippen" nicht zweimal lädt.
     */
    function ensureCamIndex() {
        if (camIndexPromise) return camIndexPromise;
        const v = window.GeopulseConfig?.VERSION || '';
        camIndexPromise = fetch(`./data/cameras.json?v=${encodeURIComponent(v)}`)
            .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
            .then((j) => {
                camIndex = j;
                document.dispatchEvent(new CustomEvent('geopulse:cameras-ready', { detail: j }));
                return j;
            })
            .catch((err) => {
                console.warn('[GEOPULSE] Kameraindex nicht ladbar:', err.message);
                camIndexPromise = null;   // ein späterer Versuch darf es erneut probieren
                throw err;
            });
        return camIndexPromise;
    }

    function buildCamPopupHtml(c) {
        const img = camImageUrl(c);
        // Pflichtangabe aus dem erzeugten Index — TfL verlangt vertraglich den
        // vollen Satz ("Powered by TfL Open Data. Contains OS data © Crown
        // copyright…"). Einzige Quelle dafür ist die JSON, damit Bauskript und
        // Anzeige nicht auseinanderlaufen. CAM_SOURCE_LABEL ist nur der
        // Notnagel, falls der Index eine unbekannte Quelle mitbringt.
        const src = camIndex?.attribution?.[c[0]] || CAM_SOURCE_LABEL[c[0]] || c[0];
        const de = currentLang === 'de';
        return `
            <div style="font-family:'Share Tech Mono',monospace; width:320px; background:rgba(0,10,20,0.97); border:1px solid #00d4ff; border-radius:4px; overflow:hidden;">
                <div style="padding:6px 10px; border-bottom:1px solid rgba(0,212,255,0.2); display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="color:#00d4ff; font-size:0.68rem; letter-spacing:1px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><i class="fa-solid fa-video" style="margin-right:4px;"></i>${escHtml(c[4])}</span>
                    <span style="font-size:0.5rem; color:#0f0; letter-spacing:1px; flex-shrink:0;">● LIVE</span>
                </div>
                <div style="position:relative; width:100%; background:#000; line-height:0;">
                    <img src="${escHtml(img)}?t=${Date.now()}" style="width:100%; height:auto; display:block; min-height:120px; object-fit:cover;"
                         alt="${escHtml(c[4])}" loading="lazy"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none; width:100%; height:140px; align-items:center; justify-content:center; flex-direction:column; background:rgba(0,0,0,0.9);">
                        <i class="fa-solid fa-signal" style="color:#ff3344; font-size:1.4rem; margin-bottom:6px;"></i>
                        <span style="color:#ff3344; font-size:0.62rem; letter-spacing:1px;">${de ? 'KEIN SIGNAL' : 'SIGNAL LOST'}</span>
                    </div>
                </div>
                <div style="padding:4px 10px 6px; font-size:0.42rem; color:rgba(255,255,255,0.3); letter-spacing:0.5px; line-height:1.35;">
                    ${escHtml(src)}${camIndex?.generated ? ` · ${de ? 'Index' : 'index'} ${escHtml(camIndex.generated)}` : ''}
                </div>
            </div>`;
    }

    function openCamPopup(c) {
        if (!camPopup) camPopup = new maplibregl.Popup({ offset: 12, maxWidth: '340px', closeButton: true });
        camPopup.setLngLat([c[3], c[2]]).setHTML(buildCamPopupHtml(c)).addTo(map);
    }

    /**
     * Abdeckungsmarken beim Herauszoomen.
     *
     * Ohne sie ist das Feature aus deutscher Sicht kaputt: die Kameras liegen in
     * London, Austin und Kalifornien, sonst nirgends. Wer in Wiesbaden auf
     * Stadtebene zoomt, sieht korrekt nichts — und hält es für einen Fehler,
     * weil ihm niemand gesagt hat, wo überhaupt etwas ist. Diese Marken sagen es,
     * und ein Klick bringt einen hin.
     */
    const camRegionMarkers = [];

    function showCamRegions() {
        if (camRegionMarkers.length || !camIndex?.regions) return;
        const de = currentLang === 'de';
        for (const r of camIndex.regions) {
            const el = document.createElement('div');
            el.className = 'marker-cam-region';
            el.style.cssText = 'cursor:pointer;white-space:nowrap;';
            el.innerHTML = `<div style="display:flex;align-items:center;gap:5px;padding:3px 9px;background:rgba(0,20,35,0.92);border:1px solid rgba(0,212,255,0.55);border-radius:11px;box-shadow:0 0 10px rgba(0,212,255,0.25);font-family:'Share Tech Mono',monospace;font-size:0.6rem;color:#00d4ff;letter-spacing:0.5px;transition:transform .15s;">
                <i class="fa-solid fa-video" style="font-size:0.55rem;opacity:.8;"></i>
                <span><strong>${r.count.toLocaleString(de ? 'de-DE' : 'en-US')}</strong> ${escHtml(de ? r.label_de : r.label_en)}</span>
            </div>`;
            const inner = el.firstElementChild;
            el.onmouseenter = () => { inner.style.transform = 'scale(1.08)'; };
            el.onmouseleave = () => { inner.style.transform = 'scale(1)'; };
            el.onclick = (ev) => {
                ev.stopPropagation();
                map.flyTo({ center: [r.lon, r.lat], zoom: 12, speed: 1.3 });
            };
            camRegionMarkers.push(new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([r.lon, r.lat]).addTo(map));
        }
    }

    function hideCamRegions() {
        camRegionMarkers.forEach((m) => m.remove());
        camRegionMarkers.length = 0;
    }

    /** Zeichnet die Kameras des aktuellen Ausschnitts und räumt weg, was hinausgescrollt ist. */
    function renderCamViewport() {
        if (!toggles.webcams || !camIndex) return;

        if (map.getZoom() < CAM_MIN_ZOOM) {
            camMarkers.forEach((m) => m.remove());
            camMarkers.clear();
            camPopup?.remove();
            showCamRegions();
            reportCamStatus(0, true);
            return;
        }
        hideCamRegions();

        const b = map.getBounds();
        const w = b.getWest(), e = b.getEast(), s = b.getSouth(), n = b.getNorth();
        const visible = [];
        for (const c of camIndex.cameras) {
            const lat = c[2], lon = c[3];
            if (lat < s || lat > n || lon < w || lon > e) continue;
            visible.push(c);
            if (visible.length >= CAM_MAX_MARKERS) break;
        }

        const keep = new Set(visible.map(camKey));
        camMarkers.forEach((m, k) => { if (!keep.has(k)) { m.remove(); camMarkers.delete(k); } });

        for (const c of visible) {
            const k = camKey(c);
            if (camMarkers.has(k)) continue;
            const el = document.createElement('div');
            el.className = 'marker-webcam marker-cctv';
            el.style.cssText = 'width:14px;height:14px;cursor:pointer;';
            el.innerHTML = '<div style="width:14px;height:14px;background:rgba(0,212,255,0.8);border-radius:50%;border:1.5px solid rgba(255,255,255,0.9);box-shadow:0 0 6px rgba(0,212,255,0.5);transition:transform 0.15s;"></div>';
            const inner = el.firstElementChild;
            el.onmouseenter = () => { inner.style.transform = 'scale(1.4)'; };
            el.onmouseleave = () => { inner.style.transform = 'scale(1)'; };
            el.title = c[4];
            // Klick statt vorgebautem Popup: 300 Popups hießen 300 <img>-Elemente,
            // also 300 Bildabrufe für Kameras, die niemand ansieht.
            el.onclick = (ev) => { ev.stopPropagation(); openCamPopup(c); };
            camMarkers.set(k, new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([c[3], c[2]]).addTo(map));
        }

        reportCamStatus(visible.length, false);
    }

    /**
     * Beantwortet "gibt es hier Kameras, und wie viele".
     *
     * Bewusst in die BESTEHENDE Beschreibungszeile des Webcam-Layers, nicht in
     * ein neues Bedienelement — die Karte bekommt durch dieses Feature keinen
     * einzigen Kasten dazu. `updateLayerStatus()` taugt dafür nicht: es pflegt
     * nur das Metadatenobjekt und fasst laut eigenem Kommentar das DOM nicht an.
     *
     * Beim ersten Schreiben wird `data-i18n` entfernt, sonst überschreibt der
     * Sprachumschalter den Zähler wieder mit dem statischen Beschreibungstext.
     * Dafür rendern wir bei Sprachwechsel selbst neu (siehe unten).
     */
    let camStatusState = { shown: 0, zoomedOut: true };

    function reportCamStatus(shown, zoomedOut) {
        camStatusState = { shown, zoomedOut };
        const el = document.getElementById('toggle-webcams')
            ?.closest('.control-item')?.querySelector('.layer-desc');
        if (!el) return;

        const total = (camIndex?.cameras.length || 0) + WEBCAM_CATALOG.length;
        const de = currentLang === 'de';
        const num = (n) => n.toLocaleString(de ? 'de-DE' : 'en-US');
        let detail;
        if (!camIndex) {
            detail = de ? `${WEBCAM_CATALOG.length} Panoramakameras` : `${WEBCAM_CATALOG.length} panorama cameras`;
        } else if (zoomedOut) {
            // Regionen NAMENTLICH nennen. "4.992 Kameras, auf Stadtebene zoomen"
            // wäre eine Lüge durch Auslassung: außerhalb dieser drei Gebiete
            // gibt es keine, und wer das nicht weiß, sucht vergeblich.
            const names = (camIndex.regions || []).map((r) => (de ? r.label_de : r.label_en));
            const list = names.length
                ? names.slice(0, -1).join(', ') + (names.length > 1 ? (de ? ' und ' : ' and ') : '') + names[names.length - 1]
                : '';
            detail = de
                ? `${num(total)} Kameras · Verkehrskameras in ${list} — dort auf Stadtebene zoomen`
                : `${num(total)} cameras · traffic cams in ${list} — zoom to city level there`;
        } else if (shown === 0) {
            // Der Fall, der das Feature kaputt aussehen lässt: Stadtebene, aber
            // außerhalb der abgedeckten Gebiete. "0 im Ausschnitt" wäre richtig
            // und trotzdem nutzlos — es muss dastehen, wo etwas zu finden ist.
            const names = (camIndex.regions || []).map((r) => (de ? r.label_de : r.label_en)).join(' · ');
            detail = de
                ? `hier keine Verkehrskameras · ${num(total)} in ${names}`
                : `no traffic cams here · ${num(total)} in ${names}`;
        } else {
            const capped = shown >= CAM_MAX_MARKERS ? '+' : '';
            detail = de
                ? `${shown}${capped} im Ausschnitt · ${num(total)} gesamt`
                : `${shown}${capped} in view · ${num(total)} total`;
        }

        el.removeAttribute('data-i18n');
        el.textContent = detail;
        if (window.updateLayerStatus) updateLayerStatus('webcams', 'LIVE', detail);
    }

    // Sprachwechsel: den Zähler in der neuen Sprache neu schreiben. Nötig, weil
    // die Zeile oben aus der i18n-Verwaltung genommen wurde.
    function refreshCamLocalisation() {
        if (!toggles.webcams) return;
        reportCamStatus(camStatusState.shown, camStatusState.zoomedOut);
        // Die Abdeckungsmarken tragen Text ("890 London") — neu aufbauen, sonst
        // steht die Zahl in der alten Sprachformatierung da.
        if (camRegionMarkers.length) { hideCamRegions(); showCamRegions(); }
    }
    document.addEventListener('setLang', () => setTimeout(refreshCamLocalisation, 0));
    const _camPrevSetLanguage = window.setLanguage;
    window.setLanguage = function (lang) {
        if (_camPrevSetLanguage) _camPrevSetLanguage(lang);
        setTimeout(refreshCamLocalisation, 0);
    };

    /** Von der Suche aufgerufen: zur Kamera fliegen und sie öffnen. */
    function focusCamera(key) {
        const c = camIndex?.cameras.find((x) => camKey(x) === key);
        if (!c) return false;
        const toggle = document.getElementById('toggle-webcams');
        if (toggle && !toggle.checked) { toggle.checked = true; toggle.dispatchEvent(new Event('change', { bubbles: true })); }
        map.flyTo({ center: [c[3], c[2]], zoom: Math.max(map.getZoom(), 14), speed: 1.2 });
        // Erst nach dem Flug öffnen, sonst steht das Popup noch am alten Ort.
        map.once('moveend', () => { renderCamViewport(); openCamPopup(c); });
        return true;
    }

    /** Damit Kameras auch bei ausgeschaltetem Layer auffindbar sind (search.js). */
    window.geopulseCameras = {
        ensureIndex: ensureCamIndex,
        focus: focusCamera,
        key: camKey,
        get index() { return camIndex; },
    };

    document.getElementById('toggle-webcams')?.addEventListener('change', (e) => {
        toggles.webcams = e.target.checked;
        if (toggles.webcams && webcamMarkers.length === 0) initWebcams();
        webcamMarkers.forEach(m => toggles.webcams ? m.addTo(map) : m.remove());

        if (toggles.webcams) {
            if (!camGridBound) {
                camGridBound = true;
                map.on('moveend', renderCamViewport);
                map.on('zoomend', renderCamViewport);
                setInterval(() => {
                    // Nur das eine offene Popup frisch halten, nicht 300 Marker.
                    if (!toggles.webcams || !camPopup?.isOpen()) return;
                    const img = camPopup.getElement()?.querySelector('img');
                    if (img) img.src = img.src.replace(/([?&]t=)\d+/, `$1${Date.now()}`);
                }, CAM_REFRESH_MS);
            }
            ensureCamIndex().then(renderCamViewport).catch(() => { /* Panoramakameras laufen weiter */ });
        } else {
            camMarkers.forEach((m) => m.remove());
            camMarkers.clear();
            hideCamRegions();
            camPopup?.remove();
        }
    });

    const initISS = () => {
        const el = document.createElement('div');
        el.className = 'marker-iss';
        el.style.cssText = 'width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;';
        el.innerHTML = `<div style="width:36px;height:36px;border-radius:50%;background:rgba(0,255,204,0.15);border:2px solid #00ffcc;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px rgba(0,255,204,0.5),0 0 40px rgba(0,255,204,0.2);animation:iss-pulse 2s ease-in-out infinite;">
            <i class="fa-solid fa-satellite" style="color:#00ffcc;font-size:14px;filter:drop-shadow(0 0 4px #00ffcc);"></i>
        </div>`;

        // Add ISS pulse animation
        if (!document.getElementById('iss-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'iss-pulse-style';
            style.textContent = `@keyframes iss-pulse { 0%,100%{box-shadow:0 0 16px rgba(0,255,204,0.5),0 0 40px rgba(0,255,204,0.2)} 50%{box-shadow:0 0 24px rgba(0,255,204,0.7),0 0 60px rgba(0,255,204,0.3)} }`;
            document.head.appendChild(style);
        }

        let issData = { latitude: 0, longitude: 0, altitude: 0, velocity: 0 };

        const issPopup = new maplibregl.Popup({ offset: 20, maxWidth: '280px', closeButton: true });

        const buildISSPopupHTML = () => `<div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;max-width:320px;">
                    <h3 style="color:#00ffcc;margin:0 0 6px;font-size:.8rem;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-satellite" style="font-size:.7rem;"></i> ${currentLang==='de'?'INTERNATIONALE RAUMSTATION':'INTERNATIONAL SPACE STATION'}
                    </h3>
                    <div style="opacity:.5;font-size:.6rem;margin-bottom:6px;">NASA / ROSCOSMOS / ESA / JAXA / CSA</div>
                    <div style="text-align:center;margin-bottom:8px;">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/International_Space_Station_after_undocking_of_STS-132.jpg/320px-International_Space_Station_after_undocking_of_STS-132.jpg"
                             alt="ISS in orbit" style="max-width:100%;height:auto;max-height:140px;border-radius:4px;border:1px solid rgba(0,255,204,0.25);box-shadow:0 4px 15px rgba(0,0,0,0.6);object-fit:cover;"
                             onerror="this.style.display='none';" />
                        <div style="font-size:.45rem;color:rgba(255,255,255,0.3);margin-top:3px;letter-spacing:1px;">${currentLang==='de'?'ISS fotografiert vom Space Shuttle — NASA':'ISS photographed from Space Shuttle — NASA'}</div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
                        <div style="background:rgba(0,255,204,.05);padding:4px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'HÖHE':'ALTITUDE'}</div>
                            <div style="color:#00ffcc;font-size:.75rem;">${Math.round(issData.altitude)} km</div>
                        </div>
                        <div style="background:rgba(0,255,204,.05);padding:4px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'GESCHW.':'SPEED'}</div>
                            <div style="color:#00ffcc;font-size:.75rem;">${Math.round(issData.velocity).toLocaleString()} km/h</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:6px;">
                        <div style="background:rgba(0,255,204,.05);padding:4px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'BREITENGRAD':'LATITUDE'}</div>
                            <div style="font-size:.65rem;">${issData.latitude.toFixed(4)}°</div>
                        </div>
                        <div style="background:rgba(0,255,204,.05);padding:4px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.5rem;">${currentLang==='de'?'LÄNGENGRAD':'LONGITUDE'}</div>
                            <div style="font-size:.65rem;">${issData.longitude.toFixed(4)}°</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px;">
                        <div style="background:rgba(0,255,204,.05);padding:3px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.45rem;">${currentLang==='de'?'MASSE':'MASS'}</div>
                            <div style="font-size:.6rem;color:#00ffcc;">420.000 kg</div>
                        </div>
                        <div style="background:rgba(0,255,204,.05);padding:3px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.45rem;">${currentLang==='de'?'BESATZUNG':'CREW'}</div>
                            <div style="font-size:.6rem;color:#00ffcc;">${currentLang==='de'?'7 Personen':'7 persons'}</div>
                        </div>
                        <div style="background:rgba(0,255,204,.05);padding:3px;text-align:center;border-radius:3px;">
                            <div style="opacity:.4;font-size:.45rem;">${currentLang==='de'?'SEIT':'SINCE'}</div>
                            <div style="font-size:.6rem;color:#00ffcc;">1998</div>
                        </div>
                    </div>
                    <div style="font-size:.55rem;opacity:.55;line-height:1.5;margin-bottom:6px;">
                        ${currentLang==='de'?'109m × 73m — größtes Bauwerk im All. Umkreist die Erde mit ~28.000 km/h. Mit bloßem Auge sichtbar. Hat 280+ Astronauten aus 21 Ländern beherbergt.':'109m × 73m — largest structure in space. Orbits at ~28,000 km/h. Visible from Earth with naked eye. Has hosted 280+ astronauts from 21 countries.'}
                    </div>
                    <a href="https://${currentLang==='de'?'de':'en'}.wikipedia.org/wiki/${currentLang==='de'?'Internationale_Raumstation':'International_Space_Station'}" target="_blank" rel="noopener"
                       style="display:block;font-size:.6rem;color:#00d4ff;text-decoration:none;letter-spacing:1px;border-top:1px solid rgba(0,212,255,.15);padding-top:4px;">
                        📚 ${currentLang==='de'?'Mehr auf Wikipedia erfahren ↗':'Learn more on Wikipedia ↗'}
                    </a>
                    <div style="opacity:.3;font-size:.45rem;margin-top:4px;letter-spacing:1px;">${currentLang==='de'?'UMKREIST DIE ERDE ALLE 90 MIN · LIVE VIA WHERETHEISS.AT':'ORBITS EARTH EVERY 90 MIN · LIVE VIA WHERETHEISS.AT'}</div>
                </div>`;

        // Update popup content on each open so telemetry is fresh
        el.addEventListener('click', () => {
            issPopup.setHTML(buildISSPopupHTML());
        });
        
        issMarker = new maplibregl.Marker({ element: el })
            .setLngLat([0,0])
            .setPopup(issPopup);

        const trackISS = async () => {
            try {
                const result = await window.reliableFetch('https://api.wheretheiss.at/v1/satellites/25544', 'iss_telemetry');
                const data = result.data;
                issData = { latitude: data.latitude, longitude: data.longitude, altitude: data.altitude, velocity: data.velocity };
                issMarker.setLngLat([data.longitude, data.latitude]);
                if (toggles.iss && !issMarker._map && !_tourActive) issMarker.addTo(map);
            } catch(e) {}
        };
        trackISS();
        setInterval(trackISS, 4000);
    };

    document.getElementById('toggle-iss')?.addEventListener('change', (e) => {
        toggles.iss = e.target.checked;
        if (toggles.iss) {
            if (!issMarker) initISS();
            else issMarker.addTo(map);
        } else {
            if (issMarker) issMarker.remove();
        }
    });

    document.getElementById('toggle-sst')?.addEventListener('change', (e) => {
        toggles.sst = e.target.checked;
        if (toggles.sst && !map.getSource('sst-src')) {
            const dateStr = getYesterdaysDateForGIBS();
            map.addSource('sst-src', {
                type: 'raster',
                tiles: [
                    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/' + dateStr + '/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png'
                ],
                tileSize: 256
            });
            map.addLayer({
                id: 'sst-layer',
                type: 'raster',
                source: 'sst-src',
                paint: { 'raster-opacity': 0.6 }
            }, map.getLayer('cables-layer') ? 'cables-layer' : undefined);
            if(window.updateLayerStatus) window.updateLayerStatus('sst', 'LIVE', 'NASA GIBS Online');
        }
        if (map.getLayer('sst-layer')) {
            map.setLayoutProperty('sst-layer', 'visibility', toggles.sst ? 'visible' : 'none');
        }
        // Show/hide SST legend
        const sstLegend = document.getElementById('layer-legend');
        if (sstLegend) sstLegend.style.display = toggles.sst ? 'block' : 'none';
        if (toggles.sst && sstLegend) {
            sstLegend.innerHTML = `<div class="legend-title">🌊 ${currentLang==='de'?'OZEANTEMPERATUR':'SEA SURFACE TEMP'} (°C)</div><div class="legend-bar" style="background:linear-gradient(90deg,#0000cc,#0066ff,#00ccff,#33ff99,#ffff00,#ff9900,#ff0000);"></div><div class="legend-labels"><span>-2</span><span>10</span><span>20</span><span>30+</span></div>`;
        }
    });

    document.getElementById('toggle-temperature')?.addEventListener('change', (e) => {
        toggles.temperature = e.target.checked;
        if (toggles.temperature && !map.getSource('temp-src')) {
            const dateStr = getYesterdaysDateForGIBS();
            map.addSource('temp-src', {
                type: 'raster',
                tiles: [
                    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/' + dateStr + '/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png'
                ],
                tileSize: 256
            });
            map.addLayer({
                id: 'temp-layer',
                type: 'raster',
                source: 'temp-src',
                paint: { 'raster-opacity': 0.55 }
            }, map.getLayer('cables-layer') ? 'cables-layer' : undefined);
            if(window.updateLayerStatus) window.updateLayerStatus('temperature', 'LIVE', 'NASA GIBS Online');
        }
        if (map.getLayer('temp-layer')) {
            map.setLayoutProperty('temp-layer', 'visibility', toggles.temperature ? 'visible' : 'none');
        }
        // Show/hide temperature legend
        const tempLegend = document.getElementById('layer-legend');
        if (tempLegend) tempLegend.style.display = toggles.temperature ? 'block' : 'none';
        if (toggles.temperature && tempLegend) {
            tempLegend.innerHTML = `<div class="legend-title">🌡️ ${currentLang==='de'?'OBERFLÄCHENTEMPERATUR':'SURFACE TEMP'} (°C)</div><div class="legend-bar" style="background:linear-gradient(90deg,#1a0533,#2b1577,#0044cc,#00bbff,#44ff88,#ccff00,#ffcc00,#ff5500,#cc0022);"></div><div class="legend-labels"><span>-25</span><span>0</span><span>25</span><span>50+</span></div>`;
        }
    });

    // ── POPULATION DENSITY TOGGLE ─────────────────────────
    document.getElementById('toggle-population')?.addEventListener('change', (e) => {
        toggles.population = e.target.checked;
        const vis = toggles.population ? 'visible' : 'none';
        if (map.getLayer('population-layer'))
            map.setLayoutProperty('population-layer', 'visibility', vis);
        if (map.getLayer('metro-cities-layer'))
            map.setLayoutProperty('metro-cities-layer', 'visibility', vis);
        if (map.getLayer('metro-cities-label'))
            map.setLayoutProperty('metro-cities-label', 'visibility', vis);
        // Show/hide population legend
        const popLegend = document.getElementById('layer-legend');
        if (popLegend) popLegend.style.display = toggles.population ? 'block' : 'none';
        if (toggles.population && popLegend) {
            popLegend.innerHTML = `<div class="legend-title">👥 ${currentLang==='de'?'BEVÖLKERUNGSDICHTE':'POPULATION DENSITY'} (per km²)</div><div class="legend-bar" style="background:linear-gradient(90deg,#000420,#0a1a4a,#1a3a7a,#3366bb,#5599dd,#88ccff,#ffee77,#ffaa33,#ff5500,#cc0000);"></div><div class="legend-labels"><span>0</span><span>50</span><span>500</span><span>5000+</span></div>`;
        }
    });

    // ── VOLCANOES (Smithsonian GVP — curated dataset) ─────
    const volcanoMarkers = [];
    const initVolcanoes = () => {
        const volcanoes = [
            [14.43,40.82,'Vesuvius','Italy','1281m','Last erupted 1944. Threatens 3M+ people in Naples.'],
            [15.21,37.73,'Mount Etna','Italy','3357m','Europe\'s most active. Erupts almost continuously.'],
            [14.96,38.79,'Stromboli','Italy','924m','Active for 2,000+ years.'],
            [-17.83,28.57,'Cumbre Vieja','Spain','2426m','2021 eruption destroyed 3,000 buildings.'],
            [-155.29,19.41,'Kilauea','USA (Hawaii)','1247m','One of most active. 2018 eruption destroyed 700 homes.'],
            [-122.20,46.20,'Mount St. Helens','USA','2549m','1980 eruption killed 57. VEI-5.'],
            [-121.76,46.85,'Mount Rainier','USA','4392m','Most dangerous in Cascades. Lahars threaten Tacoma.'],
            [29.24,-1.51,'Nyiragongo','DR Congo','3470m','Lava lake. 2021 eruption killed 32.'],
            [110.44,-7.54,'Mount Merapi','Indonesia','2930m','Most active in Indonesia. 2010 killed 353.'],
            [105.42,-6.10,'Krakatoa (Anak)','Indonesia','813m','2018 tsunami from flank collapse.'],
            [120.35,15.13,'Mount Pinatubo','Philippines','1486m','1991 VEI-6. Cooled Earth 0.5C.'],
            [130.66,31.59,'Sakurajima','Japan','1117m','Most active in Japan. Erupts hundreds of times/year.'],
            [-19.02,63.63,'Eyjafjallajokull','Iceland','1651m','2010 eruption shut down European airspace.'],
            [-17.32,64.63,'Katla','Iceland','1512m','Overdue for major eruption.'],
            [174.06,-39.28,'Mount Ruapehu','New Zealand','2797m','1953 lahar killed 151.'],
            [-78.44,-0.68,'Cotopaxi','Ecuador','5897m','One of highest active volcanoes.'],
            [-90.88,14.47,'Fuego','Guatemala','3763m','2018 eruption killed 431.'],
            [40.52,7.35,'Erta Ale','Ethiopia','613m','Persistent lava lake in Afar Depression.'],
            [-75.37,2.93,'Nevado del Ruiz','Colombia','5321m','1985 eruption killed 23,000 (Armero).'],
            [127.17,37.75,'Baekdu/Changbai','China/N.Korea','2744m','946 AD Millennium Eruption VEI-7.'],
            [168.12,-16.25,'Yasur','Vanuatu','361m','Continuously erupting for 800+ years.'],
        ];
        volcanoes.forEach(([lon, lat, name, country, elev, note]) => {
            const el = document.createElement('div');
            el.style.cssText = 'width:14px;height:14px;cursor:pointer;';
            el.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,13 1,13" fill="rgba(255,100,0,0.25)" stroke="#ff6600" stroke-width="1.2"/><circle cx="7" cy="5" r="1.5" fill="#ff4400" opacity="0.9"/></svg>';
            el.style.filter = 'drop-shadow(0 0 4px #ff6600)';
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '260px' }).setHTML(
                '<div style="font-family:\'Share Tech Mono\',monospace;font-size:.72rem;">' +
                '<h3 style="color:#ff6600;margin:0 0 5px;border-bottom:1px solid #ff660044;padding-bottom:3px;">🌋 ' + escHtml(name) + '</h3>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:5px;">' +
                '<div style="background:rgba(255,100,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">COUNTRY</div><div style="font-size:.65rem;">' + escHtml(country) + '</div></div>' +
                '<div style="background:rgba(255,100,0,.08);padding:3px 6px;"><div style="opacity:.5;font-size:.6rem;">ELEVATION</div><div style="color:#ff6600;">' + escHtml(elev) + '</div></div>' +
                '</div>' +
                '<div style="font-size:.65rem;opacity:.75;line-height:1.4;">' + escHtml(note) + '</div>' +
                '<div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: Smithsonian GVP 2024</div>' +
                '<a href="https://en.wikipedia.org/wiki/' + encodeURIComponent(name.replace(/\s+/g,'_')) + '" target="_blank" rel="noopener" style="display:block;margin-top:6px;font-size:.6rem;color:#00d4ff;text-decoration:none;letter-spacing:1px;border-top:1px solid rgba(0,212,255,.15);padding-top:4px;">📚 Learn more on Wikipedia ↗</a></div>');
            const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).setPopup(popup);
            volcanoMarkers.push(m);
        });
    };

    document.getElementById('toggle-volcanoes')?.addEventListener('change', (e) => {
        toggles.volcanoes = e.target.checked;
        if (toggles.volcanoes && volcanoMarkers.length === 0) initVolcanoes();
        volcanoMarkers.forEach(m => toggles.volcanoes ? m.addTo(map) : m.remove());
    });

    // ── RADIATION SITES (Nuclear Accidents) ───────────────
    const radiationMarkers = [];
    const initRadiation = () => {
        const sites = [
            [30.10,51.39,'Chernobyl','Ukraine','1986','RBMK-1000 meltdown. 350,000 evacuated. 30km Exclusion Zone.','CRITICAL'],
            [141.03,37.42,'Fukushima Daiichi','Japan','2011','3 reactor meltdowns after tsunami. 154,000 evacuated.','CRITICAL'],
            [-76.72,40.17,'Three Mile Island','USA','1979','Partial meltdown Unit 2. Led to major US nuclear reforms.','HIGH'],
            [30.07,46.59,'Kyshtym/Mayak','Russia','1957','3rd worst nuclear disaster (INES-6). Plutonium explosion.','HIGH'],
            [-1.19,54.42,'Windscale (Sellafield)','UK','1957','Graphite fire. Europe\'s most contaminated site.','MODERATE'],
            [140.71,41.18,'Tokaimura','Japan','1999','Criticality accident. 2 workers died from radiation.','MODERATE'],
            [26.97,65.01,'Semipalatinsk','Kazakhstan','1949-89','456 nuclear tests. 1.5M people exposed.','CRITICAL'],
            [-116.05,37.07,'Nevada Test Site','USA','1951-92','928 nuclear tests. Downwinders exposed.','HIGH'],
            [166.35,11.58,'Bikini Atoll','Marshall Islands','1946-58','67 US nuclear tests. Still uninhabitable.','CRITICAL'],
            [-149.00,-21.10,'Moruroa Atoll','French Polynesia','1966-96','193 French nuclear tests.','HIGH'],
        ];
        const sevColors = { CRITICAL: '#ff0000', HIGH: '#ff6600', MODERATE: '#ffb000' };
        sites.forEach(([lon, lat, name, country, year, note, severity]) => {
            const c = sevColors[severity] || '#ff6600';
            const el = document.createElement('div');
            el.style.cssText = 'width:16px;height:16px;cursor:pointer;';
            el.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="' + c + '15" stroke="' + c + '" stroke-width="1.5"/><text x="8" y="12" text-anchor="middle" font-size="10" fill="' + c + '">☢</text></svg>';
            el.style.filter = 'drop-shadow(0 0 5px ' + c + ')';
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '280px' }).setHTML(
                '<div style="font-family:\'Share Tech Mono\',monospace;font-size:.72rem;">' +
                '<h3 style="color:' + c + ';margin:0 0 5px;border-bottom:1px solid ' + c + '44;padding-bottom:3px;">☢ ' + escHtml(name) + '</h3>' +
                '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-bottom:5px;">' +
                '<div style="background:' + c + '11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">COUNTRY</div><div style="font-size:.6rem;">' + escHtml(country) + '</div></div>' +
                '<div style="background:' + c + '11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">YEAR</div><div style="color:' + c + ';">' + escHtml(year) + '</div></div>' +
                '<div style="background:' + c + '11;padding:3px;text-align:center;"><div style="opacity:.5;font-size:.55rem;">SEVERITY</div><div style="color:' + c + ';font-size:.6rem;">' + severity + '</div></div>' +
                '</div>' +
                '<div style="font-size:.65rem;opacity:.75;line-height:1.4;">' + escHtml(note) + '</div>' +
                '<div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: INES / IAEA / Safecast 2024</div>' +
                '<a href="https://en.wikipedia.org/wiki/' + encodeURIComponent(name.replace(/\s+/g,'_')) + '" target="_blank" rel="noopener" style="display:block;margin-top:6px;font-size:.6rem;color:#00d4ff;text-decoration:none;letter-spacing:1px;border-top:1px solid rgba(0,212,255,.15);padding-top:4px;">📚 Learn more on Wikipedia ↗</a></div>');
            const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lon, lat]).setPopup(popup);
            radiationMarkers.push(m);
        });
    };

    document.getElementById('toggle-radiation')?.addEventListener('change', (e) => {
        toggles.radiation = e.target.checked;
        if (toggles.radiation && radiationMarkers.length === 0) initRadiation();
        radiationMarkers.forEach(m => toggles.radiation ? m.addTo(map) : m.remove());
    });

    // ── AURORA FORECAST TOGGLE ────────────────────────────
    document.getElementById('toggle-aurora')?.addEventListener('change', (e) => {
        toggles.aurora = e.target.checked;
        if (map.getLayer('aurora-layer')) map.setLayoutProperty('aurora-layer', 'visibility', toggles.aurora ? 'visible' : 'none');
        if (map.getLayer('aurora-south-layer')) map.setLayoutProperty('aurora-south-layer', 'visibility', toggles.aurora ? 'visible' : 'none');
    });

    // ── FIREBALL TRACKER TOGGLE ───────────────────────────
    document.getElementById('toggle-fireballs')?.addEventListener('change', (e) => {
        toggles.fireballs = e.target.checked;
        if (map.getLayer('fireballs-core')) map.setLayoutProperty('fireballs-core', 'visibility', toggles.fireballs ? 'visible' : 'none');
        if (map.getLayer('fireballs-glow')) map.setLayoutProperty('fireballs-glow', 'visibility', toggles.fireballs ? 'visible' : 'none');
    });

    // ── NUCLEAR ARSENAL TOGGLE (nukes) ────────────────────
    document.getElementById('toggle-nukes')?.addEventListener('change', (e) => {
        toggles.nukes = e.target.checked;
        if (toggles.nukes && nukeArsenalMarkers.length === 0 && nuclearMarkers.length === 0) initNuclearLayer();
        nukeArsenalMarkers.forEach(m => toggles.nukes ? m.addTo(map) : m.remove());
    });

    // ── GLOBAL TOGGLE CLICK SOUND ──────────────────────────
    document.querySelectorAll('.control-item input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => { if (window._geoSfx) window._geoSfx.tick(); });
    });

    // ── SYSTEM OVERRIDE (toggle-all) ──────────────────────
    document.getElementById('toggle-all')?.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        const allToggles = document.querySelectorAll('.control-item input[type="checkbox"]');
        allToggles.forEach(cb => {
            if (cb.id === 'toggle-all' || cb.id === 'toggle-ticker') return;
            if (cb.checked !== isOn) {
                cb.checked = isOn;
                cb.dispatchEvent(new Event('change'));
            }
        });
        setStatus(isOn ? (currentLang === 'de' ? 'SYSTEM-OVERRIDE: ALLE EBENEN AKTIVIERT' : 'SYSTEM OVERRIDE: ALL LAYERS ACTIVATED') : (currentLang === 'de' ? 'SYSTEM-OVERRIDE: ALLE EBENEN DEAKTIVIERT' : 'SYSTEM OVERRIDE: ALL LAYERS DEACTIVATED'));
    });

    // ── NEWS BAND TOGGLE (toggle-ticker) ──────────────────
    document.getElementById('toggle-ticker')?.addEventListener('change', (e) => {
        const isOn = e.target.checked;
        if (isOn) {
            document.body.classList.remove('no-ticker');
        } else {
            document.body.classList.add('no-ticker');
        }
    });

    // ── COUNTRY BORDERS & LABELS ─────────────────────────
    const COUNTRY_CENTROIDS = [
        [-98.5,39.8,'USA'],[-106.3,56.1,'Canada'],[-102.5,23.6,'Mexico'],[-51.9,-14.2,'Brazil'],
        [-63.6,-38.4,'Argentina'],[-75.0,-9.2,'Peru'],[-71.4,4.6,'Colombia'],[-56.0,-32.5,'Uruguay'],
        [-70.6,-33.4,'Chile'],[-68.0,-16.5,'Bolivia'],[-79.5,-1.8,'Ecuador'],[-58.4,-23.4,'Paraguay'],
        [-77.8,21.5,'Cuba'],[-3.4,40.5,'Spain'],[2.2,46.6,'France'],[12.5,41.9,'Italy'],
        [10.4,51.2,'Germany'],[-1.5,52.4,'UK'],[4.5,50.5,'Belgium'],[5.3,52.1,'Netherlands'],
        [8.2,46.8,'Switzerland'],[13.5,47.5,'Austria'],[15.5,49.8,'Czechia'],[19.1,51.9,'Poland'],
        [25.3,42.7,'Bulgaria'],[24.7,45.9,'Romania'],[19.5,47.2,'Hungary'],[20.9,44.0,'Serbia'],
        [24.3,39.1,'Greece'],[35.2,39.0,'Turkey'],[14.5,56.3,'Sweden'],[8.5,60.5,'Norway'],
        [9.5,56.3,'Denmark'],[-19.0,65.0,'Iceland'],[26.0,64.0,'Finland'],[25.0,49.0,'Ukraine'],
        [28.0,53.5,'Belarus'],[90.0,62.0,'Russia'],[53.7,32.4,'Iran'],[43.7,33.2,'Iraq'],
        [45.0,24.0,'Saudi Arabia'],[55.9,25.3,'UAE'],[48.5,15.6,'Yemen'],[30.0,26.0,'Egypt'],
        [3.0,28.0,'Algeria'],[-5.0,32.0,'Morocco'],[10.0,34.0,'Tunisia'],[17.5,28.0,'Libya'],
        [8.7,9.1,'Nigeria'],[38.0,9.0,'Ethiopia'],[37.9,-0.0,'Kenya'],[32.3,1.4,'Uganda'],
        [29.9,-2.0,'Rwanda'],[34.0,-6.4,'Tanzania'],[28.0,-29.0,'South Africa'],
        [25.0,-22.3,'Botswana'],[24.0,-13.1,'Zambia'],[29.2,-19.0,'Zimbabwe'],
        [17.1,-12.3,'Angola'],[35.5,-15.4,'Malawi'],[23.7,-0.3,'DR Congo'],
        [105.0,35.0,'China'],[138.3,36.2,'Japan'],[127.8,36.0,'South Korea'],
        [77.0,20.6,'India'],[90.3,23.7,'Bangladesh'],[84.1,28.4,'Nepal'],
        [104.2,12.6,'Cambodia'],[106.3,16.0,'Laos'],[96.0,21.9,'Myanmar'],
        [100.5,13.8,'Thailand'],[108.3,14.1,'Vietnam'],[121.8,12.9,'Philippines'],
        [113.9,-0.8,'Indonesia'],[101.7,3.1,'Malaysia'],[103.8,1.4,'Singapore'],
        [133.8,-25.3,'Australia'],[174.9,-40.9,'New Zealand'],[69.0,49.0,'Kazakhstan'],
        [64.6,41.4,'Uzbekistan'],[67.7,33.9,'Afghanistan'],[69.3,30.4,'Pakistan'],
        [23.9,55.2,'Lithuania'],[24.6,56.9,'Latvia'],[25.0,58.6,'Estonia'],
        [44.6,40.1,'Armenia'],[43.4,42.3,'Georgia'],[47.6,40.1,'Azerbaijan'],
        [-8.2,53.4,'Ireland'],[14.5,46.1,'Slovenia'],[15.2,45.1,'Croatia'],
        [17.7,44.2,'Bosnia'],[20.1,41.1,'Albania'],[21.0,41.5,'N. Macedonia'],
        [-1.5,12.3,'Burkina Faso'],[-1.2,7.9,'Ghana'],[-5.5,7.5,"Côte d'Ivoire"],
        [-14.5,14.5,'Senegal'],[-11.8,10.0,'Guinea'],[1.7,12.3,'Niger'],
        [15.2,6.6,'Central African Rep.'],[11.6,6.0,'Cameroon'],
        [46.2,5.2,'Somalia'],[30.1,15.4,'Sudan'],[32.3,3.0,'South Sudan'],
        [34.3,31.5,'Israel'],[35.5,33.9,'Lebanon'],[38.9,35.0,'Syria'],
        [35.9,31.9,'Jordan'],[47.5,29.3,'Kuwait'],[50.6,26.0,'Bahrain'],
        [51.2,25.3,'Qatar'],[56.1,21.5,'Oman'],[27.9,47.4,'Moldova'],
        [19.3,42.7,'Montenegro'],[-89.0,15.8,'Guatemala'],[-86.2,12.8,'Nicaragua'],
        [-87.2,14.1,'Honduras'],[-84.1,9.7,'Costa Rica'],[-80.8,8.5,'Panama'],
        [-66.6,6.4,'Venezuela']
    ];

    document.getElementById('toggle-borders')?.addEventListener('change', async (e) => {
        toggles.borders = e.target.checked;
        if (toggles.borders && !map.getSource('borders-src')) {
            try {
                setStatus(currentLang === 'de' ? 'LÄNDERGRENZEN WERDEN GELADEN...' : 'LOADING COUNTRY BOUNDARIES...');
                const resp = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
                const world = await resp.json();
                const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
                map.addSource('borders-src', { type: 'geojson', data: borders });
                map.addLayer({
                    id: 'country-borders', type: 'line', source: 'borders-src',
                    paint: {
                        'line-color': 'rgba(255,255,255,0.35)',
                        'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 4, 1.2, 8, 1.8]
                    },
                    layout: { visibility: 'visible' }
                });
                const labelData = {
                    type: 'FeatureCollection',
                    features: COUNTRY_CENTROIDS.map(([lon, lat, name]) => ({
                        type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
                        properties: { name }
                    }))
                };
                map.addSource('country-labels-src', { type: 'geojson', data: labelData });
                map.addLayer({
                    id: 'country-labels', type: 'symbol', source: 'country-labels-src',
                    layout: {
                        'text-field': ['get', 'name'], 'text-font': ['Open Sans Regular'],
                        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 6, 3, 8, 6, 11, 8, 13],
                        'text-transform': 'uppercase', 'text-letter-spacing': 0.08,
                        'text-max-width': 8, visibility: 'visible'
                    },
                    paint: {
                        'text-color': 'rgba(255,255,255,0.45)',
                        'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.5
                    },
                    minzoom: 1, maxzoom: 8
                });
                setStatus(currentLang === 'de' ? 'LÄNDERGRENZEN GELADEN — ' + COUNTRY_CENTROIDS.length + ' NATIONEN' : 'COUNTRY BOUNDARIES LOADED — ' + COUNTRY_CENTROIDS.length + ' NATIONS');
                if(window.updateLayerStatus) window.updateLayerStatus('borders', 'LIVE', 'Natural Earth Data');
            } catch (err) {
                console.warn('[borders] Failed:', err);
                setStatus(currentLang === 'de' ? 'GRENZDATEN NICHT VERFÜGBAR' : 'BORDER DATA UNAVAILABLE');
            }
        }
        if (map.getLayer('country-borders')) map.setLayoutProperty('country-borders', 'visibility', toggles.borders ? 'visible' : 'none');
        if (map.getLayer('country-labels')) map.setLayoutProperty('country-labels', 'visibility', toggles.borders ? 'visible' : 'none');
    });

    // ============================================================
    // RELIGIOUS AFFILIATION TODAY — country choropleth (Pew 2020)
    // Colour = largest religious group per country. Descriptive only.
    // ============================================================
    const RELIGION_COLORS = {
        christian: '#6a8ec9', muslim: '#4c9a7a', hindu: '#d98a3d', buddhist: '#d4b24a',
        jewish: '#7d6bb0', unaffiliated: '#9aa3ad', other: '#b06a72'
    };
    const RELIGION_LABELS = {
        en: { christian: 'Christian', muslim: 'Muslim', hindu: 'Hindu', buddhist: 'Buddhist', jewish: 'Jewish', unaffiliated: 'Unaffiliated', other: 'Other religions' },
        de: { christian: 'Christen', muslim: 'Muslime', hindu: 'Hindus', buddhist: 'Buddhisten', jewish: 'Juden', unaffiliated: 'Konfessionslos', other: 'Andere Religionen' }
    };
    let _religionData = null;
    let _religionPopup = null;

    function renderReligionLegend(show) {
        let el = document.getElementById('religion-legend');
        if (!show) { if (el) el.style.display = 'none'; return; }
        const lang = currentLang === 'de' ? 'de' : 'en';
        const L = RELIGION_LABELS[lang];
        if (!el) {
            el = document.createElement('div');
            el.id = 'religion-legend';
            el.className = 'map-legend';
            (document.getElementById('map') || document.body).appendChild(el);
        }
        const title = lang === 'de' ? 'RELIGIONSZUGEHÖRIGKEIT (2020)' : 'RELIGIOUS AFFILIATION (2020)';
        const rows = Object.keys(RELIGION_COLORS).map(k =>
            '<div class="ml-row"><span class="ml-dot" style="background:' + RELIGION_COLORS[k] + '"></span>' + L[k] + '</div>'
        ).join('');
        el.innerHTML = '<div class="ml-title">' + title + '</div>' + rows +
            '<div class="ml-foot">Source: Pew Research Center · 2020</div>';
        el.style.display = 'block';
    }

    function onReligionClick(e) {
        if (!e.features || !e.features.length || !_religionData) return;
        const f = e.features[0];
        const iso = f.properties && f.properties.iso;
        const lang = currentLang === 'de' ? 'de' : 'en';
        const rec = iso ? _religionData.countries[iso] : null;
        const nm = (rec && rec.name) || (f.properties && f.properties.name) || '';
        let body;
        if (!rec) {
            body = '<div style="opacity:.7;font-size:.72rem">' +
                (lang === 'de' ? 'Keine Daten in diesem Snapshot.' : 'No data in this snapshot.') + '</div>';
        } else {
            const L = RELIGION_LABELS[lang];
            const rows = Object.keys(RELIGION_COLORS)
                .map(k => ({ k, v: rec.shares[k] || 0 }))
                .filter(r => r.v > 0)
                .sort((a, b) => b.v - a.v)
                .map(r => '<div class="rel-row"><span class="rel-dot" style="background:' + RELIGION_COLORS[r.k] + '"></span><span class="rel-lbl">' + L[r.k] + '</span><span class="rel-val">' + r.v + '%</span></div>')
                .join('');
            const src = lang === 'de'
                ? 'Quelle: Pew Research Center — Religionszugehörigkeit nach Ländern · 2020.'
                : 'Source: Pew Research Center — Religious Composition by Country · 2020.';
            const disc = lang === 'de'
                ? 'Zugehörigkeit ≠ Praxis oder Glaubensintensität; Erhebungsmethoden variieren je Land.'
                : 'Affiliation ≠ practice or intensity of belief; survey methods vary by country.';
            body = rows + '<div class="rel-src">' + src + '</div><div class="rel-disc">' + disc + '</div>';
        }
        const html = '<div class="religion-popup"><strong>' + nm + '</strong>' + body + '</div>';
        if (_religionPopup) _religionPopup.remove();
        _religionPopup = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
            .setLngLat(e.lngLat).setHTML(html).addTo(map);
    }

    document.getElementById('toggle-religion')?.addEventListener('change', async (e) => {
        const on = e.target.checked;
        if (on && !map.getSource('religion-src')) {
            try {
                setStatus(currentLang === 'de' ? 'RELIGIONSDATEN WERDEN GELADEN...' : 'LOADING RELIGION DATA...');
                const [worldResp, relResp] = await Promise.all([
                    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'),
                    fetch('./data/religion_composition.json')
                ]);
                const world = await worldResp.json();
                _religionData = await relResp.json();
                const fc = topojson.feature(world, world.objects.countries);
                const byNum = {};
                const pad3 = v => String(v).padStart(3, '0'); // world-atlas ids are zero-padded (e.g. "004")
                Object.keys(_religionData.countries).forEach(iso => {
                    const c = _religionData.countries[iso];
                    byNum[pad3(c.num)] = iso;
                });
                fc.features.forEach(ft => {
                    ft.properties = ft.properties || {};
                    const iso = byNum[pad3(ft.id)];
                    const rec = iso ? _religionData.countries[iso] : null;
                    ft.properties.iso = iso || null;
                    ft.properties.top = rec ? rec.top : null;
                });
                map.addSource('religion-src', { type: 'geojson', data: fc });
                const colorExpr = ['match', ['get', 'top']];
                Object.keys(RELIGION_COLORS).forEach(k => { colorExpr.push(k, RELIGION_COLORS[k]); });
                colorExpr.push('rgba(150,150,150,0.12)'); // no-data fallback
                const beforeId = map.getLayer('country-labels') ? 'country-labels' : undefined;
                map.addLayer({
                    id: 'religion-fill', type: 'fill', source: 'religion-src',
                    layout: { visibility: 'visible' },
                    paint: { 'fill-color': colorExpr, 'fill-opacity': 0.5, 'fill-outline-color': 'rgba(0,0,0,0.3)' }
                }, beforeId);
                map.on('click', 'religion-fill', onReligionClick);
                map.on('mouseenter', 'religion-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
                map.on('mouseleave', 'religion-fill', () => { map.getCanvas().style.cursor = ''; });
                setStatus(currentLang === 'de' ? 'RELIGIONSZUGEHÖRIGKEIT GELADEN (PEW · 2020)' : 'RELIGIOUS AFFILIATION LOADED (PEW · 2020)');
                if (window.updateLayerStatus) window.updateLayerStatus('religion', 'STATIC', 'Pew Research Center 2020');
            } catch (err) {
                console.warn('[religion] Failed:', err);
                setStatus(currentLang === 'de' ? 'RELIGIONSDATEN NICHT VERFÜGBAR' : 'RELIGION DATA UNAVAILABLE');
                e.target.checked = false;
                return;
            }
        }
        if (map.getLayer('religion-fill')) map.setLayoutProperty('religion-fill', 'visibility', on ? 'visible' : 'none');
        renderReligionLegend(on);
        if (!on && _religionPopup) { _religionPopup.remove(); _religionPopup = null; }
    });

    // ============================================================
    // AI GEOPOLITICAL COMPUTE CAPABILITY
    // Tracks global semiconductor, power, and AI infrastructure
    // ============================================================
    const aiAtlasMarkers = [];
    let aiAtlasSourceAdded = false;

    const AI_ATLAS_CLUSTERS = [
        {
            id: 'US-EAST',
            name: 'US-East Hub (N. Virginia)',
            lat: 38.99, lon: -77.49,
            score: 91,
            color: '#00ffcc',
            energy: 8, cooling: 6, connectivity: 10, geopolitics: 9, regulation: 8,
            desc: 'Highest global density, massive energy consumption. Backed by US grid and nuclear PPA deals (Amazon/Microsoft). Not heavily regulated compared to EU.',
            related: ['cables', 'datacenters', 'nuclear']
        },
        {
            id: 'NORDIC',
            name: 'Nordic Sovereign Hub',
            lat: 60.17, lon: 20.00,
            score: 84,
            color: '#00d4ff',
            energy: 9, cooling: 10, connectivity: 7, geopolitics: 8, regulation: 4,
            desc: 'Excellent natural cooling and 100% renewable capability. Hindered by EU AI Act regulatory friction and slightly lower bandwidth redundancy.',
            related: ['cables', 'datacenters', 'power']
        },
        {
            id: 'MENA',
            name: 'MENA Emerging Hub',
            lat: 24.5, lon: 51.5,
            score: 68,
            color: '#ffb000',
            energy: 7, cooling: 2, connectivity: 8, geopolitics: 5, regulation: 9,
            desc: 'Massive capital expenditure and hyperscale growth. However, limited freshwater for cooling, intense thermal load, and medium geopolitical instability.',
            related: ['cables', 'datacenters']
        },
        {
            id: 'APAC-TAIWAN',
            name: 'Taiwan/Singapore Corridor',
            lat: 23.69, lon: 119.5,
            score: 64,
            color: '#ff3300',
            energy: 7, cooling: 5, connectivity: 9, geopolitics: 2, regulation: 7,
            desc: 'World-class semiconductor manufacturing and hyperscale capability. Severely threatened by invasion risk and blockade scenarios.',
            related: ['cables', 'datacenters', 'conflicts']
        },
        {
            id: 'CHINA-EAST',
            name: 'China East Coast',
            lat: 31.23, lon: 121.47,
            score: 75,
            color: '#ff6600',
            energy: 9, cooling: 5, connectivity: 6, geopolitics: 7, regulation: 3,
            desc: 'Massive state-backed infrastructure. Restricted by US semiconductor export controls (A100/H100 bans) forcing internal silicon development.',
            related: ['power', 'datacenters', 'regimes']
        }
    ];

    const initAiAtlas = () => {
        if (!map.getSource('ai-atlas-connections')) {
            map.addSource('ai-atlas-connections', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: [] }
            });

            map.addLayer({
                id: 'ai-atlas-lines',
                type: 'line',
                source: 'ai-atlas-connections',
                layout: { 'line-join': 'round', 'line-cap': 'round', 'visibility': 'none' },
                paint: {
                    'line-color': '#00d4ff',
                    'line-width': 2,
                    'line-opacity': 0.6,
                    'line-dasharray': [2, 4]
                }
            });
            aiAtlasSourceAdded = true;
        }

        AI_ATLAS_CLUSTERS.forEach(cluster => {
            const el = document.createElement('div');
            el.className = 'ai-atlas-marker';
            el.innerHTML = `<div class="ai-score-ring" style="border-color: ${cluster.color}"></div>
                            <div class="ai-cluster-label" style="color: ${cluster.color}">${cluster.id}</div>`;
            
            el.addEventListener('click', () => {
                window.openBriefing({
                    id: `AIA-${cluster.id}`,
                    title: `AI CAPABILITY: ${cluster.name}`,
                    severity: cluster.score < 70 ? 'high' : (cluster.score < 80 ? 'medium' : 'low'),
                    what: `Aggregated Capability Score: ${cluster.score}/100<br><br>${cluster.desc}`,
                    why: `<strong>Energy & Thermal:</strong> ${cluster.energy}/10 (Power), ${cluster.cooling}/10 (Cooling)<br><strong>Connectivity:</strong> ${cluster.connectivity}/10<br><strong>Geopolitics:</strong> ${cluster.geopolitics}/10<br><strong>Regulation/Friction:</strong> ${cluster.regulation}/10`,
                    time: "Assessed Q2 2026",
                    source: "GEOPULSE Strategy Core",
                    location: [cluster.lon, cluster.lat],
                    relatedLayers: cluster.related.map(r => ({ label: `Toggle ${r}`, layerId: r }))
                });
            });

            const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([cluster.lon, cluster.lat]);
            aiAtlasMarkers.push(m);
        });
        
        // Build lines
        const lines = { type: 'FeatureCollection', features: [] };
        for(let i=0; i<AI_ATLAS_CLUSTERS.length; i++) {
            for(let j=i+1; j<AI_ATLAS_CLUSTERS.length; j++) {
                if(AI_ATLAS_CLUSTERS[i].score >= 70 && AI_ATLAS_CLUSTERS[j].score >= 70) {
                    lines.features.push({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: [
                            [AI_ATLAS_CLUSTERS[i].lon, AI_ATLAS_CLUSTERS[i].lat],
                            [AI_ATLAS_CLUSTERS[j].lon, AI_ATLAS_CLUSTERS[j].lat]
                        ]}
                    });
                }
            }
        }
        map.getSource('ai-atlas-connections').setData(lines);
    };

    document.getElementById('toggle-ai-atlas')?.addEventListener('change', (e) => {
        toggles.aiAtlas = e.target.checked;
        
        if (toggles.aiAtlas && aiAtlasMarkers.length === 0) {
            initAiAtlas();
        }

        aiAtlasMarkers.forEach(m => toggles.aiAtlas ? m.addTo(map) : m.remove());
        if(map.getLayer('ai-atlas-lines')) {
            map.setLayoutProperty('ai-atlas-lines', 'visibility', toggles.aiAtlas ? 'visible' : 'none');
        }

        if (toggles.aiAtlas) {
            // Auto-enable supporting layers
            const deps = ['toggle-datacenters', 'toggle-cables', 'toggle-nuclear'];
            deps.forEach(dep => {
                const cb = document.getElementById(dep);
                if (cb && !cb.checked) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change'));
                }
            });
            // Dim background (simulate Analytics mode)
            document.body.classList.add('mode-analyze');
        } else {
            document.body.classList.remove('mode-analyze');
        }
    });

    const sidePanel = document.getElementById('sidebar');
    // infoPanel already declared above — reuse it
    const expandHint = document.querySelector('.sidebar-expand-hint');
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    if (expandHint && sidePanel) {
        expandHint.addEventListener('click', () => {
            if (isTouchDevice) {
                sidePanel.classList.toggle('touch-open');
            } else {
                sidePanel.classList.toggle('sidebar-collapsed');
                if (sidePanel.classList.contains('sidebar-collapsed')) {
                    sidePanel.style.maxHeight = '42px';
                    sidePanel.style.overflowY = 'hidden';
                    expandHint.textContent = '? EXPAND';
                } else {
                    sidePanel.style.maxHeight = '90vh';
                    sidePanel.style.overflowY = 'auto';
                    expandHint.textContent = '? COLLAPSE';
                }
            }
        });
    }

    // iPad/touch: toggle info-panel on header tap
    if (isTouchDevice && infoPanel) {
        const infoHeader = infoPanel.querySelector('header');
        if (infoHeader) {
            infoHeader.addEventListener('click', () => {
                infoPanel.classList.toggle('touch-open');
            });
        }
    }

    // iPad/touch: toggle tours-hud on header tap.
    // Desktop opens the floating tours panel on hover — iOS has no hover, so in the
    // desktop layout (viewport > 768px, no bottom nav) the panel was unreachable.
    if (isTouchDevice) {
        const toursHudEl = document.getElementById('tours-hud');
        const toursHeader = toursHudEl?.querySelector('header');
        if (toursHeader) {
            toursHeader.addEventListener('click', () => {
                toursHudEl.classList.toggle('touch-open');
            });
        }
    }

    // iPad/touch: close panels when tapping the map
    if (isTouchDevice) {
        document.getElementById('map')?.addEventListener('click', () => {
            sidePanel?.classList.remove('touch-open');
            infoPanel?.classList.remove('touch-open');
            document.getElementById('tours-hud')?.classList.remove('touch-open');
        });
    }

    // ============================================================
    // WELCOME OVERLAY (First Visit Experience)
    // ============================================================
    const welcomeOverlay = document.getElementById('welcome-overlay');

    const ONBOARD_KEY = 'gp_onboarded';
    let _stopWelcomeDrift = null;

    const dismissWelcome = (startTourId) => {
        if (!welcomeOverlay) return;
        welcomeOverlay.classList.add('hidden');
        // Returning visitors skip the onboarding overlay next time
        try { localStorage.setItem(ONBOARD_KEY, '1'); } catch(e) {}
        if (_stopWelcomeDrift) { try { _stopWelcomeDrift(); } catch(e) {} }
        if (startTourId) {
            setTimeout(() => startTour(startTourId), 600);
        }
    };

    // Interest application: opens matching tour category, pre-selects quiz, toggles layers
    function applyInterest(interest) {
        if (!interest || interest === 'all') return;

        // 1. Open the matching tour category in sidebar
        const catMap = {
            geopolitics: 'geopolitics',
            history: 'history',
            science: 'science',
            sports: 'sports'
        };
        const targetCat = catMap[interest];
        if (targetCat) {
            document.querySelectorAll('.tour-category[data-cat]').forEach(cat => {
                const isMatch = cat.getAttribute('data-cat') === targetCat;
                cat.classList.toggle('open', isMatch);
            });
            // Save to collapse state
            try {
                const state = {};
                document.querySelectorAll('.tour-category[data-cat]').forEach(c => {
                    state[c.getAttribute('data-cat')] = c.classList.contains('open');
                });
                localStorage.setItem('geopulse_cat_state', JSON.stringify(state));
            } catch(e) {}
        }

        // 2. Pre-select quiz category
        const quizCatBtns = document.querySelectorAll('.quiz-cat-btn');
        quizCatBtns.forEach(btn => {
            const btnCat = btn.getAttribute('data-cat');
            btn.classList.toggle('active', btnCat === interest);
        });

        // 3. Toggle relevant layers (gently — 1-2 key layers per interest)
        const layerMap = {
            geopolitics: ['toggleConflicts'],
            history: [],
            science: ['toggleEarthquakes'],
            sports: []
        };
        const layersToActivate = layerMap[interest] || [];
        layersToActivate.forEach(fnName => {
            const btn = document.querySelector(`[onclick*="${fnName}"]`);
            if (btn && !btn.classList.contains('active')) {
                try { btn.click(); } catch(e) {}
            }
        });
    }

    if (welcomeOverlay) {
        const alreadyOnboarded = (() => { try { return localStorage.getItem(ONBOARD_KEY) === '1'; } catch(e) { return false; } })();

        if (alreadyOnboarded) {
            // Returning visitor — skip Screen 2 entirely, go straight to the map after ENTER
            welcomeOverlay.classList.add('hidden');
        } else {
            welcomeOverlay.classList.remove('hidden');

            // CTA wiring
            document.getElementById('welcome-tour')?.addEventListener('click', () => dismissWelcome('welcome'));
            document.getElementById('welcome-explore')?.addEventListener('click', () => dismissWelcome(null));

            // ── Live intelligence ticker (real feeds; hide silently on failure) ──
            (function initWelcomeTicker() {
                const el = document.getElementById('welcome-ticker');
                if (!el) return;
                const lang = (window.getLanguage && window.getLanguage()) || document.documentElement.lang || 'en';
                const de = lang === 'de';
                const coarseRegion = (lat, lon) => {
                    if (lat > 35 && lat < 72 && lon > -12 && lon < 45) return de ? 'Europa' : 'Europe';
                    if (lat > -37 && lat < 37 && lon > -18 && lon < 52) return de ? 'Afrika' : 'Africa';
                    if (lat > 5 && lat < 78 && lon > 45 && lon < 150) return de ? 'Asien' : 'Asia';
                    if (lat > -50 && lat < 13 && lon > -82 && lon < -34) return de ? 'Südamerika' : 'South America';
                    if (lat > 13 && lat < 78 && lon > -168 && lon < -52) return de ? 'Nordamerika' : 'North America';
                    if (lat > -48 && lat < -10 && lon > 110 && lon < 180) return de ? 'Australien' : 'Australia';
                    if (lon >= -70 && lon < 20) return de ? 'dem Atlantik' : 'the Atlantic';
                    if (lon >= 20 && lon < 150) return de ? 'dem Indischen Ozean' : 'the Indian Ocean';
                    return de ? 'dem Pazifik' : 'the Pacific';
                };
                Promise.allSettled([
                    fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson')
                        .then(r => r.ok ? r.json() : Promise.reject())
                        .then(d => {
                            const n = (d.features || []).length;
                            const label = window._i18n?.[lang]?.ob_ticker_quakes || 'earthquakes in the last hour';
                            return `🌍 ${n} ${label}`;
                        }),
                    fetch('https://api.wheretheiss.at/v1/satellites/25544')
                        .then(r => r.ok ? r.json() : Promise.reject())
                        .then(d => {
                            const label = window._i18n?.[lang]?.ob_ticker_iss || 'ISS over';
                            return `🛰️ ${label} ${coarseRegion(d.latitude, d.longitude)}`;
                        })
                ]).then(results => {
                    const parts = results.filter(r => r.status === 'fulfilled').map(r => r.value);
                    if (parts.length && !welcomeOverlay.classList.contains('hidden')) {
                        el.textContent = parts.join('  ·  ');
                        el.style.display = 'block';
                    }
                });
            })();

            // ── Ambient map drift behind the overlay (static on reduced-motion) ──
            (function initAmbientDrift() {
                const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (reduced || typeof map === 'undefined' || !map) return;
                let raf = null, stopped = false;
                let bearing = map.getBearing();
                const step = () => {
                    if (stopped) return;
                    bearing += 0.015;
                    try { map.setBearing(bearing); } catch(e) {}
                    raf = requestAnimationFrame(step);
                };
                raf = requestAnimationFrame(step);
                _stopWelcomeDrift = () => {
                    stopped = true;
                    if (raf) cancelAnimationFrame(raf);
                    try { map.easeTo({ bearing: 0, duration: 800 }); } catch(e) {}
                };
            })();
        }
    }

    // Expose startTour globally for the quick-links demo button
    window._geopulseStartTour = (tourId) => {
        if (typeof startTour !== 'function') return;
        const wo = document.getElementById('welcome-overlay');
        if (wo && !wo.classList.contains('hidden')) {
            wo.classList.add('hidden');
            setTimeout(() => startTour(tourId), 600);
        } else {
            startTour(tourId);
        }
    };

    // ============================================================
    // ============================================================
    // TOURS — Loaded from tours_data.js module
    // ============================================================
    const TOURS = window._TOURS_DATA || {};
    window._TOURS_REF = TOURS; // Expose for tours_de.js translations
    // Apply German translations (tours_de.js may have loaded already or not yet)
    if (typeof window._applyToursDE === 'function') window._applyToursDE();

    // ── GLOBAL TOUR SITES GLOW LAYER ──────────────────────────
    // Build a GeoJSON of all tour stop locations for a subtle ambient glow
    const TOUR_MARKER_LAYERS = new Set(['regimes', 'blocs', 'conflicts', 'nuclear', 'radiation']);
    const allTourSitesFeatures = [];
    const tourSitesMap = {}; // tourId ? [feature indices]
    let featureIdx = 0;
    Object.entries(TOURS).forEach(([tourId, tour]) => {
        // Skip the welcome tour — its locations are generic overviews, not POIs
        if (tourId === 'welcome') return;
        tourSitesMap[tourId] = [];
        tour.steps.forEach((step, stepIdx) => {
            allTourSitesFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: step.center },
                properties: {
                    tourId: tourId,
                    stepIdx: stepIdx,
                    title: step.title || '',
                    tourName: tour.name || ''
                }
            });
            tourSitesMap[tourId].push(featureIdx);
            featureIdx++;
        });
    });

    const allTourSitesGeoJSON = { type: 'FeatureCollection', features: allTourSitesFeatures };

    // Add global tour-sites source and layers after map is ready
    const initTourSitesLayer = () => {
        if (map.getSource('tour-sites-src')) return;
        map.addSource('tour-sites-src', { type: 'geojson', data: allTourSitesGeoJSON });

        // Outer glow ring — all tour sites (hidden by default, reserved for future use)
        map.addLayer({
            id: 'tour-sites-glow',
            type: 'circle',
            source: 'tour-sites-src',
            layout: { visibility: 'none' },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 8, 3, 12, 6, 18, 10, 24],
                'circle-color': 'rgba(0, 212, 255, 0.0)',
                'circle-stroke-color': 'rgba(0, 212, 255, 0.25)',
                'circle-stroke-width': 1.5,
                'circle-blur': 0.6
            }
        });

        // Core dot — all tour sites (hidden by default)
        map.addLayer({
            id: 'tour-sites-core',
            type: 'circle',
            source: 'tour-sites-src',
            layout: { visibility: 'none' },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2, 3, 3, 6, 4.5, 10, 6],
                'circle-color': 'rgba(0, 212, 255, 0.25)',
                'circle-stroke-color': 'rgba(0, 212, 255, 0.15)',
                'circle-stroke-width': 0.5
            }
        });

        // Active tour highlight source (used when a tour is running)
        map.addSource('tour-active-src', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
        });

        // Active tour glow ring (amber — only current tour's stops)
        map.addLayer({
            id: 'tour-active-glow',
            type: 'circle',
            source: 'tour-active-src',
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 22, 3, 30, 6, 40, 10, 50],
                'circle-color': 'rgba(255, 176, 0, 0.12)',
                'circle-stroke-color': 'rgba(255, 176, 0, 0.5)',
                'circle-stroke-width': 2.5
            }
        });

        // Active tour core dot (amber)
        map.addLayer({
            id: 'tour-active-core',
            type: 'circle',
            source: 'tour-active-src',
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 3, 7, 6, 9, 10, 12],
                'circle-color': 'rgba(255, 176, 0, 0.7)',
                'circle-stroke-color': 'rgba(255, 220, 100, 0.8)',
                'circle-stroke-width': 1.5
            }
        });
    };

    // Initialize once map is idle (layers loaded)
    if (map.loaded()) {
        initTourSitesLayer();
    } else {
        map.on('load', initTourSitesLayer);
    }

    // -- REFRESH TOUR SITES — called by tours_new.js after merging new tours --
    // Rebuilds the GeoJSON features array and updates the map source so that
    // late-loaded tours (Aurora Hunters, Cosmic Impacts, etc.) get map dots
    window._refreshTourSites = function() {
        // Clear and rebuild the features array from the current TOURS object
        allTourSitesFeatures.length = 0;
        Object.keys(tourSitesMap).forEach(k => delete tourSitesMap[k]);
        let idx = 0;
        Object.entries(TOURS).forEach(([tourId, tour]) => {
            if (tourId === 'welcome') return;
            tourSitesMap[tourId] = [];
            tour.steps.forEach((step, stepIdx) => {
                allTourSitesFeatures.push({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: step.center },
                    properties: {
                        tourId: tourId,
                        stepIdx: stepIdx,
                        title: step.title || '',
                        tourName: tour.name || ''
                    }
                });
                tourSitesMap[tourId].push(idx);
                idx++;
            });
        });

        // Update the map source if it already exists
        const src = map.getSource('tour-sites-src');
        if (src) {
            src.setData({ type: 'FeatureCollection', features: allTourSitesFeatures });
        }
        console.log('[_refreshTourSites] Rebuilt tour sites GeoJSON:', allTourSitesFeatures.length, 'features');
    };

    // Helper: show/hide the global tour sites ambient glow
    function setTourSitesGlowVisible(visible) {
        const vis = visible ? 'visible' : 'none';
        if (map.getLayer('tour-sites-glow')) map.setLayoutProperty('tour-sites-glow', 'visibility', vis);
        if (map.getLayer('tour-sites-core')) map.setLayoutProperty('tour-sites-core', 'visibility', vis);
    }

    // Helper: update active tour highlight layer
    function updateActiveTourLayer(tourId) {
        const src = map.getSource('tour-active-src');
        if (!src) return;
        if (!tourId || !tourSitesMap[tourId]) {
            src.setData({ type: 'FeatureCollection', features: [] });
            return;
        }
        const features = tourSitesMap[tourId].map(idx => allTourSitesFeatures[idx]);
        src.setData({ type: 'FeatureCollection', features });
    }

    // Helper: deactivate ALL markers and layers for a completely clean tour view
    // Directly removes every marker from every array — doesn't rely on checkbox toggles alone
    let _tourPreviousToggles = [];  // checkbox IDs that were checked before tour
    function deactivateAllLayersForTour() {
        _tourActive = true; // Block all data refreshes
        _tourPreviousToggles = [];

        // 1. FORCE-REMOVE every DOM marker from all marker arrays
        //    This is the nuclear option — guarantees no stray markers
        [
            regimeMarkers, blocMarkers, conflictMarkers, dcMarkers,
            nuclearMarkers, nukeArsenalMarkers, volcanoMarkers, radiationMarkers,
            webcamMarkers, flightMarkers, powerMarkers, aiAtlasMarkers
        ].forEach(arr => {
            arr.forEach(m => { try { m.remove(); } catch(e) {} });
        });

        // Also remove ISS marker if present
        if (issMarker && issMarker._map) {
            try { issMarker.remove(); } catch(e) {}
        }

        // 2. Hide ALL MapLibre native layers (comprehensive — matches actual layer IDs)
        const mlLayersToHide = [
            // Data layers
            'cables-layer',
            'earthquakes-core', 'earthquakes-ring', 'earthquakes-pulse',
            'pipelines-layer',
            'starlink-layer',
            'terminator-layer',
            'fires-layer',
            'country-borders', 'country-labels',
            'population-layer', 'temp-layer', 'sst-layer',
            'ai-atlas-lines',
            // Tour ambient dots (replaced by tour-active-glow/core during tours)
            'tour-sites-glow', 'tour-sites-core'
        ];
        mlLayersToHide.forEach(id => {
            if (map.getLayer(id)) {
                try { map.setLayoutProperty(id, 'visibility', 'none'); } catch(e) {}
            }
        });

        // 3. Uncheck ALL toggle checkboxes (comprehensive DOM sweep)
        document.querySelectorAll('.control-item input[type="checkbox"]').forEach(cb => {
            if (cb.id === 'toggle-all' || cb.id === 'toggle-ticker') return;
            if (cb.id === 'toggle-wind' && activeTourId === 'windsworld') return;
            if (cb.checked) {
                _tourPreviousToggles.push(cb.id);
                cb.checked = false;
                // Update the toggles object directly
                const key = cb.id.replace('toggle-', '');
                if (key in toggles) toggles[key] = false;
            }
        });
    }

    // Helper: restore layers that were active before the tour started
    function restoreLayersAfterTour() {
        _tourActive = false; // Re-enable data refreshes
        _tourPreviousToggles.forEach(cbId => {
            const cb = document.getElementById(cbId);
            if (cb && !cb.checked) {
                cb.checked = true;
                cb.dispatchEvent(new Event('change'));
            }
        });
        _tourPreviousToggles = [];
    }
    // ════════════════════════════════════════════════════════════
    // -----------------------------------------------------------
    // NARRATION ENGINE — Extracted to narration.js module
    // -----------------------------------------------------------
    // Loaded from narration.js before main.js.
    // Exposes: window.speakText(text), window.stopNarration()
    const speakText = window.speakText || function() {};
    const stopNarration = window.stopNarration || function() {};

    // -- Bilingual tour text helper (depends on local currentLang) --
    function getTourTitle(step) {
        return (currentLang === 'de' && step.title_de) ? step.title_de : step.title;
    }
    function getTourText(step) {
        return (currentLang === 'de' && step.text_de) ? step.text_de : step.text;
    }

    let activeTour = null;
    let tourStepIndex = 0;
    const tourPanel = document.getElementById('tour-briefing');
    const tourTitle = document.getElementById('tour-briefing-title');
    const tourText = document.getElementById('tour-briefing-text');
    const tourCounter = document.getElementById('tour-step-counter');
    const tourPrev = document.getElementById('tour-prev');
    const tourNext = document.getElementById('tour-next');
    const tourClose = document.getElementById('tour-close');

    // ── DRAGGABLE TOUR PANEL (mouse + touch) ──
    if (tourPanel) {
        const dragHeader = tourPanel.querySelector('.tour-briefing-header');
        let isDragging = false, dragOffX = 0, dragOffY = 0;

        const onDragStart = (clientX, clientY) => {
            isDragging = true;
            const rect = tourPanel.getBoundingClientRect();
            dragOffX = clientX - rect.left;
            dragOffY = clientY - rect.top;
            tourPanel.style.transition = 'none';
        };
        const onDragMove = (clientX, clientY) => {
            if (!isDragging) return;
            let nx = clientX - dragOffX;
            let ny = clientY - dragOffY;
            // Clamp within viewport
            nx = Math.max(0, Math.min(nx, window.innerWidth - 60));
            ny = Math.max(0, Math.min(ny, window.innerHeight - 40));
            tourPanel.style.left = nx + 'px';
            tourPanel.style.top = ny + 'px';
            tourPanel.style.bottom = 'auto';
            tourPanel.style.right = 'auto';
        };
        const onDragEnd = () => {
            isDragging = false;
            tourPanel.style.transition = '';
        };

        // Mouse events
        if (dragHeader) {
            dragHeader.addEventListener('mousedown', (e) => {
                if (e.target.closest('button')) return; // Don't drag when clicking buttons
                e.preventDefault();
                onDragStart(e.clientX, e.clientY);
            });
        }
        document.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY));
        document.addEventListener('mouseup', onDragEnd);

        // Touch events
        if (dragHeader) {
            dragHeader.addEventListener('touchstart', (e) => {
                if (e.target.closest('button')) return;
                const t = e.touches[0];
                onDragStart(t.clientX, t.clientY);
            }, { passive: true });
        }
        document.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const t = e.touches[0];
            onDragMove(t.clientX, t.clientY);
        }, { passive: true });
        document.addEventListener('touchend', onDragEnd);
    }

    function getTourName(tour) {
        return (currentLang === 'de' && tour.name_de) ? tour.name_de : tour.name;
    }
    function startTour(tourId) {
        const tour = TOURS[tourId];
        if (!tour) { console.warn('[startTour] Tour not found:', tourId); return; }

        // ── Close the tour menu so the tour is visible, not hidden behind it ──
        // On mobile the tours-hud opens as a full overlay (z-index 950); on iPad/touch
        // it is the expanded floating panel. Neither closed itself on tour selection,
        // so the tour appeared to "do nothing". Close it here for every entry point.
        if (window.innerWidth <= 768) {
            closeFloatingHuds();
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('.nav-btn[data-target="map"]')?.classList.add('active');
        } else {
            document.getElementById('tours-hud')?.classList.remove('touch-open');
        }

        // Guard: if map not yet fully loaded, wait then retry
        if (!map.loaded()) {
            map.once('load', () => startTour(tourId));
            return;
        }

        // ── CLEAN SLATE: deactivate all data layers for an uncluttered tour view ──
        deactivateAllLayersForTour();
        setTourSitesGlowVisible(false);

        activeTour = tour;
        activeTourId = tourId;
        tourStepIndex = 0;

        const nm = getTourName(tour).toUpperCase();
        setStatus(currentLang === 'de' ? 'GEFÜHRTE TOUR: ' + nm + ' — ÜBERSICHT' : 'GUIDED TOUR: ' + nm + ' — OVERVIEW');

        // Chime sound on tour start
        if (window._geoSfx) window._geoSfx.chime();

        // ── CINEMATIC OVERVIEW INTRO ──
        // 1. Light up all stops as bright pulsing amber dots
        // 2. Zoom out to frame the entire route (NO text panel)
        // 3. Hold for 6 seconds so the user sees all stops
        // 4. Then fly to first stop and reveal the briefing panel

        updateActiveTourLayer(activeTourId);

        // Calculate bounding box center + zoom
        const lngs = tour.steps.map(s => s.center[0]);
        const lats = tour.steps.map(s => s.center[1]);
        const overviewCenter = [
            (Math.min(...lngs) + Math.max(...lngs)) / 2,
            (Math.min(...lats) + Math.max(...lats)) / 2
        ];
        const maxSpread = Math.max(Math.max(...lngs) - Math.min(...lngs), Math.max(...lats) - Math.min(...lats));
        const overviewZoom = maxSpread > 200 ? 1 : maxSpread > 100 ? 1.8 : maxSpread > 50 ? 2.5 : maxSpread > 20 ? 3.5 : 4.5;

        // HIDE the tour panel — overview should be clean map + dots only
        if (tourPanel) tourPanel.classList.add('hidden');

        // Fly to overview position
        const transOverlay = document.getElementById('tour-transition-overlay');
        if (transOverlay) transOverlay.classList.add('active');
        if (window._geoSfx) window._geoSfx.whoosh();

        map.flyTo({
            center: overviewCenter,
            zoom: overviewZoom,
            duration: 3500,
            essential: true,
            pitch: 0,
            bearing: 0
        });

        // Remove transition overlay when overview flight completes
        map.once('moveend', () => {
            if (transOverlay) transOverlay.classList.remove('active');
        });

        // ── ANIMATED GLOW PULSE on overview dots ──
        let glowPhase = 0;
        const glowInterval = setInterval(() => {
            glowPhase = (glowPhase + 1) % 50;
            const pulseScale = 1 + 0.5 * Math.sin(glowPhase / 50 * Math.PI * 2);
            const pulseOpacity = 0.3 + 0.3 * Math.sin(glowPhase / 50 * Math.PI * 2);
            if (map.getLayer('tour-active-glow')) {
                map.setPaintProperty('tour-active-glow', 'circle-stroke-opacity', pulseOpacity);
                map.setPaintProperty('tour-active-glow', 'circle-radius',
                    ['interpolate', ['linear'], ['zoom'], 1, 22 * pulseScale, 3, 30 * pulseScale, 6, 40 * pulseScale]
                );
            }
            if (map.getLayer('tour-active-core')) {
                const corePulse = 0.5 + 0.3 * Math.sin(glowPhase / 50 * Math.PI * 2);
                map.setPaintProperty('tour-active-core', 'circle-opacity', corePulse);
            }
        }, 50);

        // After 6 seconds: stop pulsing, fly to first actual stop
        setTimeout(() => {
            clearInterval(glowInterval);
            // Reset glow to default steady state
            if (map.getLayer('tour-active-glow')) {
                map.setPaintProperty('tour-active-glow', 'circle-stroke-opacity', 0.5);
                map.setPaintProperty('tour-active-glow', 'circle-radius',
                    ['interpolate', ['linear'], ['zoom'], 1, 22, 3, 30, 6, 40, 10, 50]
                );
            }
            if (map.getLayer('tour-active-core')) {
                map.setPaintProperty('tour-active-core', 'circle-opacity', 0.7);
            }
            // Now proceed to the first tour step
            showTourStep();
        }, 6000);
    }


    // ── Typewriter effect helper ──
    let _typewriterTimer = null;
    function typewriterEffect(element, text, speed = 18, onComplete) {
        clearInterval(_typewriterTimer);
        element.innerHTML = '';
        let i = 0;
        const cursor = document.createElement('span');
        cursor.className = 'typewriter-cursor';
        element.appendChild(cursor);
        _typewriterTimer = setInterval(() => {
            if (i < text.length) {
                // Insert character before cursor
                cursor.before(document.createTextNode(text.charAt(i)));
                i++;
                // Auto-scroll the panel to keep cursor visible
                element.closest('.tour-briefing-panel')?.scrollTo({ top: element.closest('.tour-briefing-panel').scrollHeight, behavior: 'smooth' });
            } else {
                clearInterval(_typewriterTimer);
                // Remove cursor after a short delay
                setTimeout(() => cursor.remove(), 2000);
                if (onComplete) onComplete();
            }
        }, speed);
    }

    function showTourStep() {
        if (!activeTour || !tourPanel) return;
        const step = activeTour.steps[tourStepIndex];
        if (!step) return;

        // Update status bar with current stop number
        const tourNm = getTourName(activeTour).toUpperCase();
        const stopNum = tourStepIndex + 1;
        const totalStops = activeTour.steps.length;
        setStatus(currentLang === 'de' ? 'GEF\u00dcHRTE TOUR: ' + tourNm + ' \u2014 STOPP ' + stopNum + '/' + totalStops : 'GUIDED TOUR: ' + tourNm + ' \u2014 STOP ' + stopNum + '/' + totalStops);

        // Update active tour highlight on map
        updateActiveTourLayer(activeTourId);

        // During tours: ONLY activate tour-specific @-prefixed overlays (e.g. roman-empire)
        // All other layers are suppressed for a clean, focused tour experience
        if (step.layers) {
            step.layers.forEach(layerId => {
                // Only allow direct map layers prefixed with '@' (tour-specific overlays)
                if (layerId.startsWith('@')) {
                    const mlId = layerId.slice(1);
                    if (map.getLayer(mlId)) map.setLayoutProperty(mlId, 'visibility', 'visible');
                }
                // All toggle-based layers (regimes, blocs, conflicts, earthquakes, etc.)
                // are intentionally NOT activated — tour uses its own amber highlight dots
            });
        }

        // Auto-activate wind layer for Winds of the World tour
        if (activeTourId === 'windsworld') {
            const windToggle = document.getElementById('toggle-wind');
            if (windToggle && !windToggle.checked) {
                windToggle.checked = true;
                windToggle.dispatchEvent(new Event('change'));
            }
        }

        // Stop any ongoing narration + typewriter
        stopNarration();
        clearInterval(_typewriterTimer);

        // Hide briefing during flight + reset drag position to default
        tourPanel.style.left = '';
        tourPanel.style.top = '';
        tourPanel.style.bottom = '';
        tourPanel.style.right = '';
        tourPanel.classList.add('hidden');
        tourPanel.classList.add('flying');

        // Disable nav during flight
        if (tourPrev) tourPrev.disabled = true;
        if (tourNext) tourNext.disabled = true;

        // ── Tour Transition Effect (blur overlay + whoosh) ──
        const transOverlay = document.getElementById('tour-transition-overlay');
        if (transOverlay) { transOverlay.classList.add('active'); }
        if (window._geoSfx) window._geoSfx.whoosh();

        // ── Update Story-Mode Progress Bar ──
        const progressFill = document.getElementById('tour-progress-fill');
        if (progressFill && activeTour) {
            const pct = ((tourStepIndex + 1) / activeTour.steps.length) * 100;
            progressFill.style.width = pct + '%';
        }

        // ── Cinematic Camera Choreography ──
        // Each stop gets a unique bearing offset for visual variety.
        // Higher zoom stops get a dramatic pitch tilt.
        // Overview/world steps (zoom ≤ 2.5) stay flat and centered.
        const baseZoom = step.zoom;
        const zoomBoost = activeTourId === 'windsworld' ? 1 : 3;
        const boostedZoom = baseZoom <= 2.5 ? baseZoom : Math.min(baseZoom + zoomBoost, 14);
        const isCloseup = boostedZoom >= 8;

        // Cinematic bearing: alternate direction per step, ±15-30° for closeups
        const bearingOffset = isCloseup
            ? ((tourStepIndex % 2 === 0 ? 1 : -1) * (15 + (tourStepIndex * 7) % 20))
            : 0;
        const cinematicPitch = isCloseup ? 40 + Math.min(tourStepIndex * 2, 15) : (boostedZoom >= 5 ? 20 : 0);

        // -- WIND TOUR: Global context zoom --
        // For the Winds of the World tour, show global wind context first
        // then zoom into the specific stop location
        if (activeTourId === 'windsworld' && boostedZoom > 3) {
            // Phase 1: Fly to global view centered on the stop
            map.flyTo({
                center: step.center,
                zoom: 2,
                duration: 2500,
                essential: true,
                curve: 1.2,
                pitch: 0,
                bearing: 0
            });
            map.once('moveend', () => {
                // Phase 2: Hold 2s at global view, then zoom into the stop
                setTimeout(() => {
                    if (window._geoSfx) window._geoSfx.whoosh();
                    map.flyTo({
                        center: step.center,
                        zoom: boostedZoom,
                        duration: 4000,
                        essential: true,
                        curve: 1.5,
                        pitch: cinematicPitch,
                        bearing: bearingOffset
                    });
                }, 2000);
            });
        } else {
            map.flyTo({
                center: step.center,
                zoom: boostedZoom,
                duration: 5500,
                essential: true,
                curve: 1.5,
                pitch: cinematicPitch,
                bearing: bearingOffset
            });
        }

        // Show briefing AFTER flight completes
        map.once('moveend', () => {
            tourPanel.classList.remove('flying');
            // Clear transition overlay
            const transOvl = document.getElementById('tour-transition-overlay');
            if (transOvl) transOvl.classList.remove('active');
            if (window._geoSfx) window._geoSfx.tick();
            const stepTitle = getTourTitle(step);
            const stepText = getTourText(step);
            tourTitle.textContent = stepTitle;
            tourCounter.textContent = (currentLang === 'de' ? 'STOPP ' : 'STOP ') + (tourStepIndex + 1) + (currentLang === 'de' ? ' VON ' : ' OF ') + activeTour.steps.length;

            // ── Typewriter Text Reveal ──
            // Text appears character-by-character for a decoded-intel feel
            typewriterEffect(tourText, stepText, 18, () => {
                // Auto-narrate after typewriter completes (if enabled)
                const narrateActive = document.getElementById('tour-narrate');
                if (narrateActive && narrateActive.classList.contains('active')) {
                    speakText(stepText);
                }
            });

            // Load Wikipedia thumbnail image if available
            const imgContainer = document.getElementById('tour-briefing-image');
            if (imgContainer) {
                imgContainer.innerHTML = '';
                imgContainer.classList.add('hidden');
                if (step.image && step.image.wiki) {
                    const wikiLang = (currentLang === 'de') ? 'de' : 'en';
                    const wikiUrl = 'https://' + wikiLang + '.wikipedia.org/wiki/' + encodeURIComponent(step.image.wiki);
                    fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(step.image.wiki))
                        .then(r => r.json())
                        .then(data => {
                            if (data.thumbnail && data.thumbnail.source) {
                                const link = document.createElement('a');
                                link.href = wikiUrl;
                                link.target = '_blank';
                                link.rel = 'noopener';
                                link.title = (currentLang === 'de') ? 'Wikipedia-Artikel öffnen' : 'Open Wikipedia article';
                                const img = document.createElement('img');
                                img.src = data.thumbnail.source;
                                img.alt = step.image.caption || step.title;
                                img.loading = 'lazy';
                                img.style.cursor = 'pointer';
                                link.appendChild(img);
                                const cap = document.createElement('div');
                                cap.className = 'tour-image-caption';
                                cap.textContent = step.image.caption || '';
                                imgContainer.appendChild(link);
                                imgContainer.appendChild(cap);
                                imgContainer.classList.remove('hidden');
                            }
                        })
                        .catch(() => {}); // Silent fail — image is optional enrichment
                    // Update wiki link in hint
                    const wikiLink = document.getElementById('tour-wiki-link');
                    if (wikiLink) {
                        wikiLink.href = wikiUrl;
                        wikiLink.style.display = '';
                    }
                } else {
                    // No wiki image — hide wiki link
                    const wikiLink = document.getElementById('tour-wiki-link');
                    if (wikiLink) wikiLink.style.display = 'none';
                }
            }

            // Load YouTube video if available (Video Pilot)
            const vidContainer = document.getElementById('tour-briefing-video');
            if (vidContainer) {
                vidContainer.innerHTML = '';
                vidContainer.classList.add('hidden');
                if (step.video) {
                    const badge = document.createElement('div');
                    badge.className = 'tour-video-badge';
                    badge.innerHTML = '<i class="fa-solid fa-film"></i> VIDEO PILOT';
                    // Clickable thumbnail card — opens YouTube in new tab (no embed/CSP issues)
                    const card = document.createElement('a');
                    card.href = 'https://www.youtube.com/watch?v=' + step.video;
                    card.target = '_blank';
                    card.rel = 'noopener noreferrer';
                    card.className = 'tour-video-card';
                    card.title = 'Watch on YouTube';
                    card.style.cssText = 'display:block;position:relative;border-radius:8px;overflow:hidden;cursor:pointer;text-decoration:none;border:1px solid rgba(255,0,0,0.3);background:#0a0a0a;transition:all .3s;';
                    // YouTube thumbnail
                    const thumb = document.createElement('img');
                    thumb.src = 'https://img.youtube.com/vi/' + step.video + '/hqdefault.jpg';
                    thumb.alt = 'Video thumbnail';
                    thumb.style.cssText = 'width:100%;height:auto;display:block;opacity:.85;transition:opacity .3s;';
                    thumb.onerror = function() { this.src = 'https://img.youtube.com/vi/' + step.video + '/mqdefault.jpg'; };
                    // Play button overlay
                    const playBtn = document.createElement('div');
                    playBtn.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:56px;height:40px;background:rgba(255,0,0,0.85);border-radius:10px;display:flex;align-items:center;justify-content:center;transition:all .3s;';
                    playBtn.innerHTML = '<i class="fa-solid fa-play" style="color:#fff;font-size:16px;margin-left:2px;"></i>';
                    // Label bar
                    const label = document.createElement('div');
                    label.style.cssText = 'padding:8px 12px;background:rgba(0,0,0,0.9);color:rgba(255,255,255,0.7);font-family:\"Share Tech Mono\",monospace;font-size:0.6rem;letter-spacing:1px;display:flex;align-items:center;gap:6px;';
                    label.innerHTML = '<i class="fa-brands fa-youtube" style="color:#ff0000;font-size:0.8rem;"></i> WATCH ON YOUTUBE <i class="fa-solid fa-external-link" style="opacity:.4;font-size:0.5rem;margin-left:auto;"></i>';
                    // Hover effects
                    card.onmouseenter = function() { this.style.borderColor='rgba(255,0,0,0.6)'; thumb.style.opacity='1'; playBtn.style.background='rgba(255,0,0,1)'; playBtn.style.transform='translate(-50%,-50%) scale(1.1)'; };
                    card.onmouseleave = function() { this.style.borderColor='rgba(255,0,0,0.3)'; thumb.style.opacity='.85'; playBtn.style.background='rgba(255,0,0,0.85)'; playBtn.style.transform='translate(-50%,-50%) scale(1)'; };
                    card.appendChild(thumb);
                    card.appendChild(playBtn);
                    card.appendChild(label);
                    vidContainer.appendChild(badge);
                    vidContainer.appendChild(card);
                    vidContainer.classList.remove('hidden');
                }
            }

            tourPanel.classList.remove('hidden');

            // Re-enable nav
            if (tourPrev) tourPrev.disabled = false;
            if (tourNext) tourNext.disabled = false;

            // Update nav buttons
            tourPrev.style.display = tourStepIndex === 0 ? 'none' : 'flex';
            if (tourStepIndex < activeTour.steps.length - 1) {
                tourNext.innerHTML = 'NEXT <i class="fa-solid fa-chevron-right"></i>';
            } else {
                tourNext.innerHTML = '<i class="fa-solid fa-check"></i> FINISH TOUR';
            }

            // ── Cinematic Orbital Drift ──
            // After landing, slowly rotate the camera 8° for a living-map feel
            if (isCloseup) {
                setTimeout(() => {
                    if (!activeTour) return; // Tour may have ended
                    map.easeTo({
                        bearing: bearingOffset + 8,
                        duration: 4000,
                        easing: t => t * (2 - t) // ease-out
                    });
                }, 800);
            }
        });
    }

    function endTour() {
        activeTour = null;
        activeTourId = null;
        tourStepIndex = 0;
        if (tourPanel) tourPanel.classList.add('hidden');
        stopNarration();
        clearInterval(_typewriterTimer);
        // Reset progress bar
        const progressFill = document.getElementById('tour-progress-fill');
        if (progressFill) progressFill.style.width = '0%';
        // Reset camera to flat north-up
        map.easeTo({ bearing: 0, pitch: 0, duration: 1500 });
        // Hide tour-specific overlay layers
        ['roman-empire-fill', 'roman-empire-border'].forEach(id => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
        });
        // Clear active tour highlight (no ambient glow — dots only appear during tours)
        updateActiveTourLayer(null);

        // Restore layers that were active before the tour started
        restoreLayersAfterTour();

        setStatus(currentLang === 'de' ? 'TOUR ABGESCHLOSSEN — FREI ERKUNDEN' : 'TOUR COMPLETE — EXPLORE FREELY');
    }

    tourPrev?.addEventListener('click', () => {
        if (tourStepIndex > 0) { tourStepIndex--; showTourStep(); }
    });
    tourNext?.addEventListener('click', () => {
        if (activeTour && tourStepIndex < activeTour.steps.length - 1) {
            tourStepIndex++;
            showTourStep();
        } else {
            endTour();
        }
    });
    // Audio narrate button — speak current step immediately on click
    const narrateBtn = document.getElementById('tour-narrate');
    if (narrateBtn) {
        // Remove inline onclick (set in HTML) and use proper handler
        narrateBtn.removeAttribute('onclick');
        narrateBtn.addEventListener('click', () => {
            narrateBtn.classList.toggle('active');
            if (narrateBtn.classList.contains('active')) {
                // Start narrating the current step text
                if (activeTour) {
                    const currentText = document.getElementById('tour-briefing-text')?.textContent;
                    if (currentText) speakText(currentText);
                }
            } else {
                // Deactivated — stop speaking
                stopNarration();
            }
        });
    }

    tourClose?.addEventListener('click', () => endTour());

    // Sidebar tour buttons
    document.querySelectorAll('.tour-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tourId = btn.dataset.tour;
            if (tourId) startTour(tourId);
        });
    });

    // -- WIDGETS (wiki helper, feedback, clock): loaded from widgets.js module --


    // ═══════════════════════════════════════════════════════════════
    // ── GEOQUIZ INITIALIZATION (Phase 2, V2.2) ───────────────────
    // ═══════════════════════════════════════════════════════════════

    (function initQuiz() {
        let quizCategory = 'all';
        let quizDifficulty = 'explorer';

        // Category buttons
        document.querySelectorAll('.quiz-cat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-cat-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                quizCategory = btn.getAttribute('data-cat');
            });
        });

        // Difficulty buttons
        document.querySelectorAll('.quiz-diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quiz-diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                quizDifficulty = btn.getAttribute('data-diff');
            });
        });

        // Start button
        const startBtn = document.getElementById('quiz-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (typeof GeoQuiz === 'undefined' || typeof QUIZ_BANK === 'undefined') {
                    console.warn('[GEOPULSE] Quiz engine or bank not loaded');
                    return;
                }
                const quiz = new GeoQuiz(map);
                quiz.start(quizCategory, quizDifficulty, 10);
                // Close sidebar on mobile
                const sidebar = document.getElementById('sidebar');
                if (window.innerWidth < 900 && sidebar) sidebar.classList.remove('open');
            });
        }

        console.log('[GEOPULSE] GeoQuiz initialized');
    })();

    // -- WIND LAYER INIT (wind.js module) ---------------------
    window._GEOPULSE_MAP = map;
    if (typeof window.initWindLayer === 'function') {
        window.initWindLayer(map);
        console.log('[GEOPULSE] Wind layer initialized');
    }

    // ── SMART SIDEBAR SEARCH: loaded from search.js module ──

    // ═══════════════════════════════════════════════════════════════
    // ── OPTION D: Category Collapse Memory + Smart Defaults + 🆕 ──
    // ═══════════════════════════════════════════════════════════════

    // --- 1. Collapse Memory ---
    // Save and restore which tour categories are open/closed
    const CAT_STATE_KEY = 'geopulse_cat_state';
    const FIRST_VISIT_KEY = 'geopulse_first_visit_done';

    // Default categories to open on first visit — empty = all collapsed for cleaner overview
    const FIRST_VISIT_DEFAULTS = [];

    // All tour categories (exclude the Religion teaser — non-interactive scaffold)
    const tourCats = document.querySelectorAll('.tour-category[data-cat]:not(.tour-category-teaser)');

    // Accordion: only one category open at a time
    tourCats.forEach(cat => {
        const header = cat.querySelector('.tour-cat-header');
        if (!header) return;

        // Remove inline onclick (we manage it now)
        header.removeAttribute('onclick');

        header.addEventListener('click', () => {
            const willOpen = !cat.classList.contains('open');
            // Collapse every category first (single-open accordion)
            tourCats.forEach(c => c.classList.remove('open'));
            if (willOpen) cat.classList.add('open');
            saveCatState();
        });
    });

    // ── Dynamic counters (single source of truth = the tour registry) ──
    function refreshTourCounts() {
        let total = 0;
        document.querySelectorAll('.tour-category[data-cat]').forEach(cat => {
            const n = cat.querySelectorAll('.tour-cat-body .tour-btn[data-tour]').length;
            const countEl = cat.querySelector('.tour-cat-count');
            if (countEl) countEl.textContent = n;
            total += n;
        });
        document.querySelectorAll('.tours-count-num').forEach(el => { el.textContent = total; });
        return total;
    }
    const TOUR_TOTAL = refreshTourCounts();
    console.log('[GEOPULSE] Tour registry total:', TOUR_TOTAL);

    // ── Propagate NEW badge up to the category header ──
    document.querySelectorAll('.tour-category[data-cat]').forEach(cat => {
        if (cat.querySelector('.tour-btn[data-new], .tour-btn .tour-new-badge')) {
            cat.querySelector('.tour-cat-header')?.classList.add('cat-has-new');
        }
    });

    // ── Hero tour buttons (collapsed-state showcase) launch their tour ──
    document.querySelectorAll('.tour-hero-btn[data-tour]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.tour;
            if (id && typeof startTour === 'function') startTour(id);
        });
    });

    function saveCatState() {
        const state = {};
        tourCats.forEach(cat => {
            const key = cat.getAttribute('data-cat');
            if (key) state[key] = cat.classList.contains('open');
        });
        try { localStorage.setItem(CAT_STATE_KEY, JSON.stringify(state)); } catch(e) {}
    }

    function restoreCatState() {
        // Always start with all categories collapsed for a clean overview
        tourCats.forEach(cat => {
            cat.classList.remove('open');
        });
    }

    restoreCatState();

    // ── Inline tour filter (visible search box at head of the tour panel) ──
    (function initTourFilter() {
        const input = document.getElementById('tour-filter');
        const clearBtn = document.getElementById('tour-filter-clear');
        const emptyMsg = document.getElementById('tour-filter-empty');
        const body = document.querySelector('.tours-hud-body');
        if (!input || !body) return;

        // Build a bilingual search index from the registry buttons
        const idx = [];
        body.querySelectorAll('.tour-cat-body .tour-btn[data-tour]').forEach(btn => {
            const id = btn.dataset.tour;
            const key = btn.querySelector('[data-i18n]')?.getAttribute('data-i18n');
            const en = (window._i18n?.en?.[key] || btn.textContent || '').toLowerCase();
            const de = (window._i18n?.de?.[key] || '').toLowerCase();
            idx.push({ btn, cat: btn.closest('.tour-category'), text: (en + ' ' + de + ' ' + id).toLowerCase() });
        });

        function apply(q) {
            q = q.trim().toLowerCase();
            clearBtn.style.display = q ? 'block' : 'none';
            if (!q) {
                body.classList.remove('filtering');
                idx.forEach(it => it.btn.classList.remove('filter-miss'));
                document.querySelectorAll('.tour-category').forEach(c => c.classList.remove('filter-hit', 'filter-miss'));
                if (emptyMsg) emptyMsg.style.display = 'none';
                return;
            }
            body.classList.add('filtering');
            const words = q.split(/\s+/).filter(Boolean);
            let hits = 0;
            const catHits = new Map();
            idx.forEach(it => {
                const match = words.every(w => it.text.includes(w));
                it.btn.classList.toggle('filter-miss', !match);
                if (match) { hits++; catHits.set(it.cat, true); }
            });
            document.querySelectorAll('.tour-category[data-cat]').forEach(cat => {
                const hit = catHits.get(cat);
                cat.classList.toggle('filter-hit', !!hit);
                cat.classList.toggle('filter-miss', !hit);
            });
            if (emptyMsg) emptyMsg.style.display = hits ? 'none' : 'block';
        }

        let t;
        input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => apply(input.value), 100); });
        clearBtn.addEventListener('click', () => { input.value = ''; apply(''); input.focus(); });
        input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; apply(''); input.blur(); } });
    })();

    // --- 2. ?? Badges for V2.0 tours ---
    // Tours added in V2.0 (released May 15, 2026)
    const V2_NEW_TOURS = [
        'aurorahunters', 'cosmicimpacts', 'climatecrisis',
        'greatmigrations', 'spycraft', 'iconicarenas'
    ];
    const V2_RELEASE_DATE = new Date('2026-05-15');
    const BADGE_DURATION_DAYS = 30;
    const now = new Date();
    const daysSinceV2 = (now - V2_RELEASE_DATE) / (1000 * 60 * 60 * 24);

    if (daysSinceV2 <= BADGE_DURATION_DAYS) {
        V2_NEW_TOURS.forEach(tourId => {
            const btn = document.querySelector(`.tour-btn[data-tour="${tourId}"]`);
            if (btn) {
                const badge = document.createElement('span');
                badge.className = 'tour-new-badge';
                badge.textContent = 'NEW';
                badge.title = 'New in V2.0';
                btn.style.position = 'relative';
                btn.appendChild(badge);
            }
        });

        // Update category headers with "new" count
        const catNewCounts = {};
        V2_NEW_TOURS.forEach(tourId => {
            const btn = document.querySelector(`.tour-btn[data-tour="${tourId}"]`);
            if (btn) {
                const cat = btn.closest('.tour-category[data-cat]');
                if (cat) {
                    const key = cat.getAttribute('data-cat');
                    catNewCounts[key] = (catNewCounts[key] || 0) + 1;
                }
            }
        });

        Object.entries(catNewCounts).forEach(([catKey, count]) => {
            const cat = document.querySelector(`.tour-category[data-cat="${catKey}"]`);
            if (!cat) return;
            const countEl = cat.querySelector('.tour-cat-count');
            if (countEl) {
                const total = countEl.textContent.trim();
                countEl.innerHTML = `${total} <span class="cat-new-indicator">• ${count} new</span>`;
            }
        });
    }

    console.log('[GEOPULSE] Option D: Collapse memory + NEW badges initialized');

}); // end DOMContentLoaded

/* ══════════════════════════════════════════════════════════════════════════
   LEFT-COLUMN EXCLUSIVITY CONTROLLER                    (added 2026-08-26)
   ══════════════════════════════════════════════════════════════════════════
   Publishes which left-column panel is currently open as `data-gp-panel` on
   <body>; the stylesheet uses it to let the siblings step aside (see the
   "LEFT COLUMN" block at the end of style.css).

   Deliberately self-contained and appended at the end: it owns exactly one
   attribute, reads no app state, and can be deleted in one piece. It does NOT
   open or close anything — expansion stays with the existing :hover and
   .touch-open rules; this only reports what is already open.
   ────────────────────────────────────────────────────────────────────────── */
(function gpLeftColumnExclusivity() {
    var PANEL_IDS = ['tours-hud', 'quiz-hud'];
    var DESKTOP = '(min-width: 769px)';

    function init() {
        var body = document.body;
        if (!body) return;

        var clearTimer = null;

        function setOpen(id) {
            if (clearTimer) { clearTimeout(clearTimer); clearTimer = null; }
            if (id) body.setAttribute('data-gp-panel', id);
            else body.removeAttribute('data-gp-panel');
        }

        // Small grace period on leave: moving the pointer between the header
        // and the body of the same panel briefly leaves both, and clearing
        // instantly would make the neighbours flash back in.
        function scheduleClear() {
            if (clearTimer) clearTimeout(clearTimer);
            clearTimer = setTimeout(function () { setOpen(null); }, 120);
        }

        PANEL_IDS.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;

            el.addEventListener('mouseenter', function () {
                // Touch devices fire synthetic mouse events; there the
                // .touch-open observer below is the source of truth.
                if (!window.matchMedia(DESKTOP).matches) return;
                if (!window.matchMedia('(hover: hover)').matches) return;
                setOpen(id);
            });
            el.addEventListener('mouseleave', function () {
                if (!window.matchMedia('(hover: hover)').matches) return;
                scheduleClear();
            });

            // Touch/pointer-coarse path: the app toggles `.touch-open` itself,
            // so mirror that class rather than guessing from touch events.
            if (typeof MutationObserver === 'function') {
                new MutationObserver(function () {
                    if (!window.matchMedia(DESKTOP).matches) return;
                    if (el.classList.contains('touch-open')) setOpen(id);
                    else if (body.getAttribute('data-gp-panel') === id) setOpen(null);
                }).observe(el, { attributes: true, attributeFilter: ['class'] });
            }
        });

        // Leaving the viewport entirely (alt-tab, cursor off-window) must not
        // strand the column in a half-open state.
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) setOpen(null);
        });
        window.addEventListener('blur', function () { setOpen(null); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
