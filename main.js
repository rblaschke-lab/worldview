document.addEventListener("DOMContentLoaded", () => {
    // ----------------------------------------------------
    // CONSTANTS & STATE
    // ----------------------------------------------------
    // Security: HTML escape helper to prevent XSS from external API data
    const escHtml = (s) => { const d = document.createElement('div'); d.textContent = String(s || ''); return d.innerHTML; };
    const VERSION = window.WorldviewConfig.VERSION;
    
    // Increment and get session count
    const getSessionCount = () => {
        let count = parseInt(localStorage.getItem('worldviewSessionCount') || '1242', 10);
        count++;
        localStorage.setItem('worldviewSessionCount', count);
        return count;
    };
    const sessionCount = getSessionCount();
    const sessionEl = document.getElementById('session-count');
    if (sessionEl) sessionEl.innerText = `${(sessionCount).toLocaleString()}`;

    // ----------------------------------------------------
    // i18n TRANSLATION SYSTEM (EN / DE)
    // ----------------------------------------------------
    const i18n = {
        en: {
            mode_explore: 'EXPLORE', mode_analyze: 'ANALYZE',
            status_active: 'GLOBAL COMMAND ACTIVE', system_override: 'SYSTEM OVERRIDE',
            news_band: 'GLOBAL NEWS BAND', cat_scenarios: 'GLOBAL SCENARIOS',
            reset_layers: 'RESET LAYERS', command_manual: 'COMMAND MANUAL',
            cat_realtime: 'REAL-TIME TRACKING', cat_geopolitics: 'GEOPOLITICS',
            cat_environment: 'ENVIRONMENT & SPACE',
            layer_ships: 'AIS Shipping', desc_ships: 'Live vessel positions via AIS transponders. Includes cargo and military ships.',
            layer_flights: 'Lufthansa Flights', desc_flights: 'Real-time aircraft positions via OpenSky Network radar.',
            layer_iss: 'ISS Tracker', desc_iss: 'International Space Station — orbits Earth every 90 minutes at 28,000 km/h.',
            layer_earthquakes: 'Earthquakes', desc_earthquakes: 'Live seismic events from USGS. Circle size = magnitude. Updated every 5 min.',
            layer_fires: 'NASA Wildfires', desc_fires: 'Active fire detection by NASA FIRMS satellites. Near real-time hotspots.',
            layer_terminator: 'Day/Night Line', desc_terminator: 'Solar terminator — the real-time boundary between day and night on Earth.',
            layer_regimes: 'Regime Types', desc_regimes: 'Government systems by country — democracy, autocracy, or hybrid regime.',
            layer_blocs: 'Alliances & Blocs', desc_blocs: 'NATO, BRICS, EU, ASEAN — major geopolitical alliance networks.',
            layer_conflicts: 'Active Conflicts', desc_conflicts: 'Currently active war zones and armed conflicts worldwide.',
            layer_cables: 'Undersea Cables', desc_cables: 'Submarine fiber optic cables — 95% of global internet traffic travels here.',
            layer_nuclear: 'Nuclear Plants', desc_nuclear: 'Operational nuclear power stations and their energy output worldwide.',
            layer_sst: 'Ocean Temperature', desc_sst: 'Sea surface temperature from NOAA. Red = warmer, blue = cooler than average.',
            layer_temperature: 'Surface Temperature', desc_temperature: 'Land surface temperature data showing global heat distribution.',
            layer_population: 'Population Density', desc_population: 'Global population heatmap — bright areas = high population concentration.',
            layer_volcanoes: 'Volcanoes', desc_volcanoes: 'Historically active volcanoes from Smithsonian Global Volcanism Program.',
            layer_radiation: 'Radiation Sites', desc_radiation: 'Notable nuclear accident sites — Chernobyl, Fukushima, and others.',
            layer_starlink: 'Starlink Net', desc_starlink: 'SpaceX Starlink satellite constellation — 5,000+ internet satellites in orbit.',
            upcoming_launches: 'Upcoming Launches', solar_index: 'SOLAR STORM INDEX',
            solar_connecting: 'CONNECTING TO NOAA SWPC...', data_sources_label: 'DATA SOURCES:',
            nav_scope: 'SCOPE', nav_intel: 'INTEL', nav_layers: 'LAYERS', nav_info: 'INFO',
            intel_title: 'INTELLIGENCE', intel_subtitle: 'CORE_ANOMALY_SCANNER',
            intel_init: 'INITIALIZING AI CORE...', intel_init_desc: 'Establishing spatial aggregation patterns.',
            intel_awaiting: 'AWAITING TELEMETRY',
            info_title: 'ABOUT THIS MAP', info_subtitle: 'DATA_SOURCES & METHODOLOGY',
            info_how_title: '📖 How to Read This Map',
            info_how_desc: 'Toggle data layers from the LAYERS panel to overlay real-time feeds and reference data onto the satellite map. Click any marker for detailed briefings. Use the mode switcher (EXPLORE / ANALYZE) to adjust the visual focus.',
            info_sources_title: '📡 Live Data Sources',
            info_src_usgs: 'Seismic events updated every 5 minutes. earthquake.usgs.gov',
            info_src_firms: 'Active wildfire hotspots via VIIRS/MODIS satellites. firms.modaps.eosdis.nasa.gov',
            info_src_iss: 'ISS orbital position in real time. wheretheiss.at',
            info_src_noaa: 'Sea surface temperature & solar weather data. noaa.gov',
            info_src_freedom: 'Regime types, alliances, and geopolitical blocs. Static reference data.',
            info_src_infra: 'Submarine cables and nuclear power plant databases.',
            info_explore_title: '🔬 Explore Further',
            info_about_title: 'ℹ️ About Worldview',
            info_about_desc: 'Worldview is an open-source global intelligence dashboard built with MapLibre GL JS and vanilla JavaScript. No API keys, no accounts — just real-time data from public sources.',
            info_full_about: 'Full About Page ↗', info_manual_link: 'Command Manual ↗',
            orientation_hint: 'BEST EXPERIENCED IN LANDSCAPE', launch_connecting: 'CONNECTING TO LAUNCH LIBRARY...'
        },
        de: {
            mode_explore: 'ERKUNDEN', mode_analyze: 'ANALYSIEREN',
            status_active: 'GLOBALES KOMMANDO AKTIV', system_override: 'SYSTEM OVERRIDE',
            news_band: 'GLOBALER NACHRICHTEN-TICKER', cat_scenarios: 'GLOBALE SZENARIEN',
            reset_layers: 'EBENEN ZURÜCKSETZEN', command_manual: 'KOMMANDO-HANDBUCH',
            cat_realtime: 'ECHTZEIT-TRACKING', cat_geopolitics: 'GEOPOLITIK',
            cat_environment: 'UMWELT & WELTRAUM',
            layer_ships: 'AIS Schiffsverkehr', desc_ships: 'Echtzeit-Schiffspositionen via AIS-Transponder. Fracht- und Militärschiffe.',
            layer_flights: 'Lufthansa Flüge', desc_flights: 'Echtzeit-Flugzeugpositionen über OpenSky Network Radar.',
            layer_iss: 'ISS Tracker', desc_iss: 'Internationale Raumstation — umkreist die Erde alle 90 Minuten mit 28.000 km/h.',
            layer_earthquakes: 'Erdbeben', desc_earthquakes: 'Live-Seismik von USGS. Kreisgröße = Magnitude. Aktualisierung alle 5 Min.',
            layer_fires: 'NASA Waldbrände', desc_fires: 'Aktive Branderkennung durch NASA FIRMS Satelliten. Nahezu Echtzeit.',
            layer_terminator: 'Tag/Nacht-Linie', desc_terminator: 'Solarterminator — die Echtzeit-Grenze zwischen Tag und Nacht auf der Erde.',
            layer_regimes: 'Regimetypen', desc_regimes: 'Regierungssysteme nach Land — Demokratie, Autokratie oder Hybridregime.',
            layer_blocs: 'Allianzen & Blöcke', desc_blocs: 'NATO, BRICS, EU, ASEAN — große geopolitische Bündnisnetzwerke.',
            layer_conflicts: 'Aktive Konflikte', desc_conflicts: 'Derzeit aktive Kriegsgebiete und bewaffnete Konflikte weltweit.',
            layer_cables: 'Unterseekabel', desc_cables: 'Unterwasser-Glasfaserkabel — 95% des globalen Internetverkehrs fließen hier.',
            layer_nuclear: 'Kernkraftwerke', desc_nuclear: 'Betriebsbereite Kernkraftwerke und ihre Energieleistung weltweit.',
            layer_sst: 'Ozeantemperatur', desc_sst: 'Meeresoberflächentemperatur von NOAA. Rot = wärmer, blau = kühler als Durchschnitt.',
            layer_temperature: 'Oberflächentemperatur', desc_temperature: 'Landoberflächentemperaturdaten zur globalen Wärmeverteilung.',
            layer_population: 'Bevölkerungsdichte', desc_population: 'Globale Bevölkerungsheatmap — helle Bereiche = hohe Bevölkerungskonzentration.',
            layer_volcanoes: 'Vulkane', desc_volcanoes: 'Historisch aktive Vulkane vom Smithsonian Global Volcanism Program.',
            layer_radiation: 'Strahlungsorte', desc_radiation: 'Bemerkenswerte Nuklearunfälle — Tschernobyl, Fukushima und andere.',
            layer_starlink: 'Starlink Netz', desc_starlink: 'SpaceX Starlink Satellitenkonstellation — 5.000+ Internet-Satelliten im Orbit.',
            upcoming_launches: 'Bevorstehende Starts', solar_index: 'SONNENSTURM-INDEX',
            solar_connecting: 'VERBINDUNG ZU NOAA SWPC...', data_sources_label: 'DATENQUELLEN:',
            nav_scope: 'KARTE', nav_intel: 'INTEL', nav_layers: 'EBENEN', nav_info: 'INFO',
            intel_title: 'AUFKLÄRUNG', intel_subtitle: 'KERN-ANOMALIE-SCANNER',
            intel_init: 'AI-KERN INITIALISIEREN...', intel_init_desc: 'Räumliche Aggregationsmuster werden etabliert.',
            intel_awaiting: 'WARTE AUF TELEMETRIE',
            info_title: 'ÜBER DIESE KARTE', info_subtitle: 'DATENQUELLEN & METHODIK',
            info_how_title: '📖 Karte lesen',
            info_how_desc: 'Schalten Sie Datenebenen im EBENEN-Panel ein, um Echtzeit-Feeds und Referenzdaten auf die Satellitenkarte zu legen. Klicken Sie auf Marker für detaillierte Briefings. Nutzen Sie den Modus-Schalter (ERKUNDEN / ANALYSIEREN).',
            info_sources_title: '📡 Live-Datenquellen',
            info_src_usgs: 'Seismische Ereignisse alle 5 Minuten aktualisiert. earthquake.usgs.gov',
            info_src_firms: 'Aktive Waldbrand-Hotspots via VIIRS/MODIS Satelliten. firms.modaps.eosdis.nasa.gov',
            info_src_iss: 'ISS Orbitalposition in Echtzeit. wheretheiss.at',
            info_src_noaa: 'Meeresoberflächentemperatur & Sonnenwetterdaten. noaa.gov',
            info_src_freedom: 'Regimetypen, Allianzen und geopolitische Blöcke. Statische Referenzdaten.',
            info_src_infra: 'Unterseekabel- und Kernkraftwerk-Datenbanken.',
            info_explore_title: '🔬 Weiter erkunden',
            info_about_title: 'ℹ️ Über Worldview',
            info_about_desc: 'Worldview ist ein Open-Source Global Intelligence Dashboard, gebaut mit MapLibre GL JS und Vanilla JavaScript. Keine API-Schlüssel, keine Konten — nur Echtzeitdaten aus öffentlichen Quellen.',
            info_full_about: 'Vollständige About-Seite ↗', info_manual_link: 'Kommando-Handbuch ↗',
            orientation_hint: 'AM BESTEN IM QUERFORMAT', launch_connecting: 'VERBINDUNG ZUR LAUNCH LIBRARY...'
        }
    };

    let currentLang = localStorage.getItem('worldviewLang') || 'en';

    const setLanguage = (lang) => {
        currentLang = lang;
        localStorage.setItem('worldviewLang', lang);
        document.getElementById('app-root')?.setAttribute('lang', lang);
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        const dict = i18n[lang] || i18n.en;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (dict[key]) el.textContent = dict[key];
        });
    };

    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });

    // Apply saved language on load
    setLanguage(currentLang);

    const toggles = {
        terminator: false, fires: false, weather: false, borders: false,
        ships: false, flights: false, iss: false, starlink: false, earthquakes: false, webcams: false,
        nightlights: false, population: false, satellites: false, temperature: false,
        volcanoes: false, radiation: false, internet: false, power: false, intel: false,
        cables: false, datacenters: false, nuclear: false, conflicts: false, regimes: false, blocs: false, aiAtlas: false
    };

    let issMarker = null;
    let flightMarkers = [];
    let shipMarkers = [];
    let webcamMarkers = [];
    let powerMarkers = [];
    let intelMarkers = [];
    let terminatorInterval = null;
    let tacticalQueue = [];
    let tacticalProcessing = false;

    // ----------------------------------------------------
    // 2-MODE SYSTEM: EXPLORE, ANALYZE
    // ----------------------------------------------------
    const modeConfig = {
        EXPLORE: {
            autoActiveLayers: ['terminator'],
            uiState: { sidebarCollapsed: true, intelPanelOpen: false },
            disablePolling: ['flights', 'iss', 'earthquakes', 'ships']
        },
        ANALYZE: {
            autoActiveLayers: ['cables', 'blocs'],
            uiState: { sidebarCollapsed: false, intelPanelOpen: false },
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
            layers: ['ships', 'flights', 'cables', 'conflicts', 'regimes', 'nukes'],
            title: "Taiwan Escalation",
            what: "A sudden military mobilization in the Taiwan Strait disrupts global commercial shipping and reroutes international flights.",
            why: "Strategic undersea internet cables are flagged at high risk, and regional tension escalates to DEFCON alert levels.",
            center: [120.9, 23.7],
            zoom: 5.0,
            severity: "CRITICAL"
        },
        redsea: {
            layers: ['ships', 'conflicts', 'power', 'internet', 'regimes'],
            title: "Red Sea Crisis",
            what: "Asymmetric attacks and naval posturing in the Red Sea cause a massive rerouting of global shipping around the Cape of Good Hope.",
            why: "Critical energy transit is delayed, and regional IT infrastructure experiences anomalous outages.",
            center: [38.5, 19.5],
            zoom: 4.5,
            severity: "HIGH"
        },
        nuclear: {
            layers: ['nukes', 'radiation', 'conflicts', 'blocs', 'flights', 'satellites'],
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
                    if (['ticker', 'intel', 'all'].includes(key)) return;
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
                
                if(window.setStatus) setStatus(`SCENARIO LOADED: ${scenario.title.toUpperCase()}`);
                
                // Fall back to ANALYZE mode automatically for full dashboard visibility
                if (switchMode && currentMode !== 'ANALYZE') switchMode('ANALYZE');
            });
        });

        document.getElementById('clear-scenarios')?.addEventListener('click', () => {
            Object.keys(toggles).forEach(key => {
                if (['ticker', 'intel', 'all'].includes(key)) return;
                const cb = document.getElementById(`toggle-${key}`);
                if(cb && cb.checked) {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change'));
                }
            });
            if(window.closeBriefing) window.closeBriefing();
            map.flyTo({ center: [15.0, 48.0], zoom: 2.2, pitch: 0, duration: 3000 });
            if(window.setStatus) setStatus(`ALL LAYERS RESET`);
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
            if (['toggle-ticker', 'toggle-intel', 'toggle-all'].includes(cb.id)) return;
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
                <p>${escHtml(eventData.what)}</p>
                <h3>ASSESSMENT</h3>
                <p>${escHtml(eventData.why)}</p>
                
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
    const initLayerBadges = () => {
        const metadata = window.WorldviewConfig.LAYER_METADATA;
        if (!metadata) {
            console.error("LAYER_METADATA not found in config!");
            return;
        }

        let badgeCount = 0;
        document.querySelectorAll('.control-item').forEach(item => {
            const labelEle = item.querySelector('span'); // Find the first span which is the label
            const toggle = item.querySelector('input[type="checkbox"]');
            if (labelEle && toggle && toggle.id.startsWith('toggle-')) {
                const id = toggle.id.replace('toggle-', '');
                const meta = metadata[id];
                if (meta) {
                    item.dataset.layerId = id;
                    labelEle.outerHTML = `
                        <div class="layer-name-container" style="display:flex; flex-direction:column; gap:2px; padding-bottom:4px; flex:1;">
                            <span style="font-size:0.72rem;">${meta.name}</span>
                            <span class="layer-status-badge status-${meta.status.toLowerCase()}" id="badge-${id}" title="Source: ${meta.source} | Rel: ${meta.reliabilityScore}%">${meta.status}</span>
                        </div>
                    `;
                    badgeCount++;
                }
            }
        });
        console.log(`Initialized ${badgeCount} layer badges.`);
    };

    const updateLayerStatus = (id, status, infoMsg = "") => {
        const meta = window.WorldviewConfig.LAYER_METADATA?.[id];
        if (!meta) return;

        meta.status = status;
        meta.lastUpdate = Date.now();

        const badgeEl = document.getElementById(`badge-${id}`);
        if (badgeEl) {
            badgeEl.className = `layer-status-badge status-${status.toLowerCase()}`;
            badgeEl.innerHTML = status;
            
            let tooltipText = `Source: ${meta.source} | Rel: ${meta.reliabilityScore}%`;
            if (infoMsg) {
                tooltipText += ` | Info: ${infoMsg}`;
                // Log to terminal if it's an error
                if (status === 'ERROR') {
                    if (typeof addTacticalLog === 'function') {
                        addTacticalLog(`DATASTREAM_LOSS [${id.toUpperCase()}]: ${infoMsg}`, 'alert');
                    } else {
                        console.error(`[LAYER STATUS] ${id} failed: ${infoMsg}`);
                    }
                } else if (status === 'DEGRADED') {
                    if (typeof addTacticalLog === 'function') {
                        addTacticalLog(`DATASTREAM_DEGRADED [${id.toUpperCase()}]: ${infoMsg}`, 'warn');
                    }
                }
            }
            badgeEl.title = tooltipText;
        }
    };
    
    // Initialize UI badges immediately
    initLayerBadges();

    // ----------------------------------------------------
    const statusText = document.getElementById("status-text");
    const setStatus = (msg) => { if(statusText) statusText.innerText = msg; };
    window.setStatus = setStatus;
    const sidebar = document.getElementById('sidebar');
    const intelPanel = document.getElementById('intelligence-panel');
    const infoPanel = document.getElementById('info-panel');
    let activeMobilePanel = null;
    const switchSection = (target) => {
        if(window.innerWidth > 768) return;
        if (activeMobilePanel === target && target !== 'map') {
            sidebar.classList.remove('active');
            intelPanel.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            const scopeBtn = document.querySelector('.nav-btn[data-target="map"]');
            if (scopeBtn) scopeBtn.classList.add('active');
            return;
        }
        sidebar.classList.remove('active');
        intelPanel.classList.remove('active');
        if (infoPanel) infoPanel.classList.remove('active');
        document.body.classList.remove('mobile-panel-open');
        activeMobilePanel = null;
        if(target === 'layers') {
            sidebar.classList.add('active');
            document.body.classList.add('mobile-panel-open');
            activeMobilePanel = 'layers';
            const fs = sidebar.querySelector('.collapsible-section:not(.open)');
            if (fs && !sidebar.querySelector('.collapsible-section.open')) fs.classList.add('open');
        }
        if(target === 'intel') {
            intelPanel.classList.add('active');
            document.body.classList.add('mobile-panel-open');
            activeMobilePanel = 'intel';
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
            intelPanel.classList.remove('active');
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
            intelPanel.classList.remove('active');
            if (infoPanel) infoPanel.classList.remove('active');
            document.body.classList.remove('mobile-panel-open');
            activeMobilePanel = null;
            document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
            const scopeBtn = document.querySelector('.nav-btn[data-target="map"]');
            if (scopeBtn) scopeBtn.classList.add('active');
        }
    });


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
        if (/esa|ariane/i.test(name)) return '🇪🇺';
        if (/roscosmos|russia/i.test(name)) return '🛸';
        if (/isro/i.test(name)) return '🇮🇳';
        if (/cnsa|china/i.test(name)) return '🇨🇳';
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
                return `<div style="padding:4px 0;border-bottom:1px solid rgba(255,100,0,.15);font-size:.65rem;">
                    <div style="color:#ff9955;">${icon} ${escHtml(name.length > 28 ? name.slice(0,27)+'…' : name)}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:2px;">
                        <span style="opacity:.55;">${escHtml(rocket)}</span>
                        ${countdown}
                    </div>
                    ${pad ? `<div style="opacity:.35;font-size:.58rem;">${escHtml(pad)}</div>` : ''}
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
            const popup = new maplibregl.Popup({ offset: 8, maxWidth: '240px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <h3 style="color:${c};margin:0 0 5px;border-bottom:1px solid ${c}44;padding-bottom:3px;">${country}</h3>
                <div style="background:${c}22;padding:4px 7px;border-left:2px solid ${c};margin-bottom:5px;">
                    <strong>${bloc}</strong>${since ? ` &mdash; Member since ${since}` : ' &mdash; Non-member'}
                </div>
                <div style="font-size:.65rem;opacity:.75;">${note || 'No additional data.'}</div>
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
        // Red Sea routing: Med → Port Said [32.3,31] → Red Sea → Bab el-Mandeb [43,11.5]
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
            // ── EUROPE / MED → INDIAN OCEAN via Suez ─────────────────────────
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
            parties: [['🇷🇺 Russia', 'Aggressor'], ['🇺🇦 Ukraine', 'Defender']],
            support: 'UA: NATO/EU aid. RU: Iran, DPRK, Belarus.',
            casualties: '~500,000–700,000 (KIA + WIA, both sides)',
            displaced: '~8M refugees, 5M internally displaced',
            status: 'ACTIVE — Frontline mostly static, drone war escalating',
            note: 'Largest land war in Europe since WWII. Started with full invasion Feb 24, 2022.'
        },
        {
            name: 'Gaza — Israel Conflict', lat: 31.35, lon: 34.30, severity: 'CRITICAL',
            type: 'Military Operation / Urban Warfare', since: 2023,
            parties: [['🇮🇱 Israel (IDF)', 'Military operation'], ['🇵🇸 Hamas', 'Gaza de-facto govt']],
            support: 'IL: US military aid. Hamas: Iran, Hezbollah.',
            casualties: '>48,000 Palestinian dead (UN est.), ~1,200 Israeli on Oct 7',
            displaced: '~1.9M Gazans (90% of population)',
            status: 'ACTIVE — Ongoing IDF operations, humanitarian crisis',
            note: 'Triggered by Hamas attack on Oct 7, 2023. Ceasefire negotiations ongoing.'
        },
        {
            name: 'West Bank Escalation', lat: 32.1, lon: 35.2, severity: 'HIGH',
            type: 'Occupation / Armed Clashes', since: 1967,
            parties: [['🇮🇱 Israel (settlers/IDF)', 'Occupying force'], ['🇵🇸 Palestinian groups', 'Resistance']],
            support: 'US veto in UNSC. PA security forces partially cooperate with IDF.',
            casualties: '>700 Palestinians killed in 2024 (highest since 2nd Intifada)',
            displaced: 'Tens of thousands in recent raids (Jenin, Tulkarm)',
            status: 'ESCALATING — Large-scale IDF raids ongoing 2025',
            note: 'Occupation since 1967. Settler violence and IDF incursions dramatically increased post-Oct 7.'
        },
        {
            name: 'Sudan — Civil War', lat: 15.5, lon: 32.5, severity: 'CRITICAL',
            type: 'Civil War', since: 2023,
            parties: [['🇸🇩 SAF (Army)', 'Official military'], ['RSF (Rapid Support Forces)', 'Paramilitary']],
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
            parties: [['🇪🇹 ENDF (Ethiopian Army)', 'Federal government'], ['FANO / OLA', 'Amhara & Oromo armed groups']],
            support: 'ENDF: Eritrea (limited). FANO/OLA: diaspora funding.',
            casualties: 'Thousands dead; Tigray war (ended 2022): ~300,000-500,000',
            displaced: '>4M total (all Ethiopian conflicts combined)',
            status: 'ACTIVE — FANO controls parts of Amhara; OLA active in Oromia',
            note: 'Post-Tigray peace deal (Nov 2022) new conflicts erupted in Amhara and Oromia regions.'
        },
        {
            name: 'Somalia — Al-Shabaab', lat: 5.0, lon: 45.5, severity: 'HIGH',
            type: 'Islamist Insurgency', since: 2006,
            parties: [['🇸🇴 Somali Federal Govt + ATMIS', 'UN-backed government'], ['Al-Shabaab (AQ-affiliate)', 'Controls large rural areas']],
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
            parties: [['🇨🇩 FARDC + FDLR', 'DRC government army'], ['M23 (Rwanda-backed)', 'Rebel group']],
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
            parties: [['🇮🇶 Iraqi Security Forces + PMF', 'Government + Iran-backed militia'], ['Islamic State (IS)', 'Surviving sleeper cells']],
            support: 'ISF: US air support, Iranian PMF. IS: self-financed cells.',
            casualties: '>200,000 dead (IS peak 2014-2017); ongoing ~500/yr',
            displaced: 'Most of 6M Iraqi IDPs returned; ~1.2M still displaced',
            status: 'LOW INTENSITY — IS cells active in Kirkuk, Diyala, Anbar deserts',
            note: 'IS "caliphate" defeated 2019, but cells persist. 1-2 attacks/week. Iran-backed PMF tensions rising.'
        },
        {
            name: 'Syria — Post-War Transition', lat: 35.5, lon: 38.5, severity: 'HIGH',
            name: 'Pakistan — TTP Insurgency', lat: 33.0, lon: 70.5, severity: 'MODERATE',
        conflictMarkers.forEach(m => toggles.conflicts ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-regimes')?.addEventListener('change', (e) => {
    document.getElementById('toggle-nukes')?.addEventListener('change', (e) => {
        toggles.nukes = e.target.checked;
        console.log('[NUKES] toggled', toggles.nukes, '| markers:', nukeArsenalMarkers.length);
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
                    source: "Worldview Strategy Core",
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
    const expandHint = document.querySelector('.sidebar-expand-hint');
    if (expandHint && sidePanel) {
        expandHint.addEventListener('click', () => {
            if (sidePanel.style.maxHeight === '90vh') {
                sidePanel.style.maxHeight = '42px';
            } else {
                sidePanel.style.maxHeight = '90vh';
                sidePanel.style.overflowY = 'auto';
            }
        });
    }

});
