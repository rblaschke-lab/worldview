document.addEventListener("DOMContentLoaded", () => {
    // 2. Initialize V4 MapLibre GL JS
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
            sources: {
                'esri-satellite': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
                    maxzoom: 15,
                    attribution: '&copy; Esri &mdash; NASA / USGS'
                }
            },
            layers: [{
                id: 'base-map',
                type: 'raster',
                source: 'esri-satellite',
                minzoom: 0,
                maxzoom: 15
            }]
        },
        center: [15.0, 48.0],
        zoom: 2, 
        pitch: 0, 
        bearing: 0,
        projection: { type: 'globe' }, 
        dragRotate: true,
        dragPan: true,
        scrollZoom: true
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-left');

    const statusText = document.getElementById("status-text");
    const setStatus = (msg) => { statusText.innerText = msg; };

    // State & Layers
    let issMarker = null;
    let flightMarkers = [];
    let shipMarkers = [];
    let webcamMarkers = [];
    let terminatorInterval = null;
    
    // Application State
    const toggles = {
        terminator: false, fires: false, weather: false, borders: false,
        ships: false, flights: false, iss: false, starlink: false, earthquakes: false, webcams: false,
        nightlights: false, population: false, satellites: false, temperature: false,
        volcanoes: false, radiation: false, internet: false, conflicts: false
    };

    map.on('load', () => {
        // --- MOBILE MENU BEHAVIOR ---
        let menuToggleLock = false;
        const sidebar = document.getElementById('sidebar');
        const mobileBtn = document.getElementById('mobile-menu-btn');
        
        if (mobileBtn && sidebar) {
            mobileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // prevent map from catching the initial click
                
                menuToggleLock = true;
                sidebar.classList.toggle('open');
                
                // Keep the lock active for 300ms to swallow any double taps or ghost MapLibre canvas events!
                setTimeout(() => { menuToggleLock = false; }, 300);
            });
        }

        map.on('click', () => {
            // Prevent MapLibre from capturing the exact same touch down event and instantly closing it
            if (menuToggleLock) return;
            
            if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
        // -----------------------------

        // --- MAP DATA INITIALIZATION ---
        setStatus("SATELLITE DOWNLINK ESTABLISHED. INITIALIZING MODEL V4.1.");

        // Draw Solar Terminator Night Shadow Before Weather/Other Data
        map.addSource('terminator', {
            type: 'geojson',
            data: getTerminatorGeoJSON()
        });
        map.addLayer({
            id: 'terminator-layer',
            type: 'fill',
            source: 'terminator',
            layout: { visibility: 'none' },
            paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.65
            }
        });

        // Setup Cities Layer (Appears on zoom)
        const cities = [
            {name: "Tokyo", lat: 35.6762, lon: 139.6503},
            {name: "Delhi", lat: 28.7041, lon: 77.1025},
            {name: "Shanghai", lat: 31.2304, lon: 121.4737},
            {name: "São Paulo", lat: -23.5505, lon: -46.6333},
            {name: "Mexico City", lat: 19.4326, lon: -99.1332},
            {name: "Cairo", lat: 30.0444, lon: 31.2357},
            {name: "Mumbai", lat: 19.0760, lon: 72.8777},
            {name: "Beijing", lat: 39.9042, lon: 116.4074},
            {name: "Dhaka", lat: 23.8103, lon: 90.4125},
            {name: "Osaka", lat: 34.6937, lon: 135.5023},
            {name: "New York", lat: 40.7128, lon: -74.0060},
            {name: "Karachi", lat: 24.8607, lon: 67.0011},
            {name: "Buenos Aires", lat: -34.6037, lon: -58.3816},
            {name: "Chongqing", lat: 29.5332, lon: 106.5029},
            {name: "Istanbul", lat: 41.0082, lon: 28.9784},
            {name: "Kolkata", lat: 22.5726, lon: 88.3639},
            {name: "Manila", lat: 14.5995, lon: 120.9842},
            {name: "Lagos", lat: 6.5244, lon: 3.3792},
            {name: "Rio", lat: -22.9068, lon: -43.1729},
            {name: "Kinshasa", lat: -4.4419, lon: 15.2663},
            {name: "Los Angeles", lat: 34.0522, lon: -118.2437},
            {name: "Moscow", lat: 55.7558, lon: 37.6173},
            {name: "Paris", lat: 48.8566, lon: 2.3522},
            {name: "Bogotá", lat: 4.7110, lon: -74.0721},
            {name: "Jakarta", lat: -6.2088, lon: 106.8456},
            {name: "Lima", lat: -12.0464, lon: -77.0428},
            {name: "Bangkok", lat: 13.7563, lon: 100.5018},
            {name: "Seoul", lat: 37.5665, lon: 126.9780},
            {name: "London", lat: 51.5074, lon: -0.1278},
            {name: "Tehran", lat: 35.6892, lon: 51.3890},
            {name: "Chicago", lat: 41.8781, lon: -87.6298},
            {name: "Hong Kong", lat: 22.3193, lon: 114.1694},
            {name: "Berlin", lat: 52.5200, lon: 13.4050},
            {name: "Madrid", lat: 40.4168, lon: -3.7038},
            {name: "Rome", lat: 41.9028, lon: 12.4964},
            {name: "Sydney", lat: -33.8688, lon: 151.2093},
            {name: "Toronto", lat: 43.6510, lon: -79.3470},
            {name: "Johannesburg", lat: -26.2041, lon: 28.0473},
            {name: "Dubai", lat: 25.2048, lon: 55.2708},
            {name: "Singapore", lat: 1.3521, lon: 103.8198}
        ];
        
        map.addSource('cities', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: cities.map(c => ({
                    type: 'Feature',
                    properties: { name: c.name.toUpperCase() },
                    geometry: { type: 'Point', coordinates: [c.lon, c.lat] }
                }))
            }
        });

        map.addLayer({
            id: 'cities-label',
            type: 'symbol',
            source: 'cities',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': ['Open Sans Regular'],
                'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    2.0, 8,
                    6.0, 14,
                    10.0, 20
                ],
                'text-anchor': 'center'
            },
            paint: {
                'text-color': '#ffb000',
                'text-halo-color': 'rgba(0, 0, 0, 0.9)',
                'text-halo-width': 2,
                'text-opacity': [
                    'interpolate', ['linear'], ['zoom'],
                    2.0, 0.4,     // partly visible even when zoomed out
                    4.0, 1.0      // fully bright orange
                ]
            }
        });

        // Setup Earthquake geojson source
        map.addSource('earthquakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        // V4.1: Data-Driven Styling for Earthquakes (Size & Color by Magnitude)
        map.addLayer({
            id: 'earthquakes-core',
            type: 'circle',
            source: 'earthquakes',
            layout: { visibility: 'none' },
            paint: { 
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'mag'],
                    1.0, 4,
                    4.0, 8,  
                    6.0, 14,  
                    8.0, 24  
                ],
                'circle-color': [
                    'step', ['get', 'mag'],
                    'rgba(255, 176, 0, 0.4)',  // < 4.0: Subtle Amber
                    4.0, '#ffb000',            // >= 4.0: Solid Amber
                    6.0, '#ff3300'             // >= 6.0: Neon Orange / Danger Red
                ],
                'circle-opacity': 0.85 
            }
        });
        map.addLayer({
            id: 'earthquakes-halo',
            type: 'circle',
            source: 'earthquakes',
            layout: { visibility: 'none' },
            paint: { 
                'circle-radius': [
                    'interpolate', ['linear'], ['get', 'mag'],
                    1.0, 8,
                    4.0, 16,
                    6.0, 32,
                    8.0, 80
                ],
                'circle-color': 'transparent', 
                'circle-stroke-width': [
                    'step', ['get', 'mag'],
                    1.0,       // < 4.0
                    4.0, 1.5,
                    6.0, 3     // >= 6.0: Bold stroke
                ], 
                'circle-stroke-color': [
                    'step', ['get', 'mag'],
                    'rgba(255, 176, 0, 0.3)',  // < 4.0: Subtle
                    4.0, '#ffb000',
                    6.0, '#ff3300'             // >= 6.0: Neon Orange
                ],
                'circle-stroke-opacity': 0.85 
            }
        });

        // Initialize Feeds
        fetchNASA_Fires();
        fetchWeather();
        fetchNightLights();         // Night Light Pollution
        fetchPopulationDensity();   // Population Density
        fetchTemperatureLayer();    // Global Warming / Surface Temp
        initVolcanoes();            // Active Volcanoes
        initRadiationSites();       // Radiation Hotspots
        fetchSolarStorm();          // Solar Storm / Kp Index
        setInterval(fetchSolarStorm, 60000); // Refresh every minute
        fetchInternetOutages();     // Internet Outages (IODA)
        setInterval(fetchInternetOutages, 300000); // Refresh every 5 min
        fetchLaunches();                    // Rocket Launch Tracker
        setInterval(fetchLaunches, 600000); // Refresh every 10 min
        fetchISS();
        setInterval(fetchISS, 5000);
        initGhostFleet();
        fetchEarthquakes();
        fetchFlights();
        initWebcams();
        initStarlink();
        initSatelliteTracker();     // NEW
        initIntelligenceCore();
        initConflictZones();         // Conflict Zones
        
        // Dynamically update shadow every 60 seconds
        terminatorInterval = setInterval(() => {
            if(map.getSource('terminator')) {
                map.getSource('terminator').setData(getTerminatorGeoJSON());
            }
        }, 60000);
    });

    // ----------------------------------------------------
    // API: Solar Terminator Math (Pure JS Astro-Logic)
    // ----------------------------------------------------
    const getTerminatorGeoJSON = () => {
        const now = new Date();
        const t = now.getTime() / 86400000.0 + 2440587.5;
        const d = t - 2451545.0;
        const g = (357.529 + 0.98560028 * d) % 360;
        const q = (280.459 + 0.98564736 * d) % 360;
        const l = q + 1.915 * Math.sin(g * Math.PI / 180) + 0.020 * Math.sin(2 * g * Math.PI / 180);
        const e = 23.439 - 0.00000036 * d;
        
        const declination = Math.asin(Math.sin(e * Math.PI / 180) * Math.sin(l * Math.PI / 180)) * 180 / Math.PI;
        const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
        const subsolarLon = (-(gmst * 15)) % 360; 
    
        let coords = [];
        for (let lon = -180; lon <= 180; lon += 1) {
            const dLon = (lon - subsolarLon) * Math.PI / 180;
            let lat = Math.atan(-Math.cos(dLon) / Math.tan(declination * Math.PI / 180)) * 180 / Math.PI;
            coords.push([lon, lat]);
        }
    
        const poleLat = declination > 0 ? -90 : 90;
        coords.push([180, poleLat], [-180, poleLat], [coords[0][0], coords[0][1]]);
    
        return {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                geometry: { type: "Polygon", coordinates: [coords] }
            }]
        };
    };

    // ----------------------------------------------------
    // API: NASA FIRMS (Global Wildfires)
    // ----------------------------------------------------
    const fetchNASA_Fires = () => {
        // NASA GIBS tiles are typically 24-48 hours behind real time.
        const pastDate = "2023-08-15"; // Historic Anchor: Intense global wildfire season (100% Tile Availability!)

        try {   
            map.addLayer({
                id: 'nasa-fires',
                type: 'raster',
                source: {
                    type: 'raster',
                    tiles: [
                        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_All/default/${pastDate}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`
                    ],
                    tileSize: 256,
                    maxzoom: 15
                },
                paint: {
                    'raster-opacity': 0.8
                }
            }, 'terminator-layer');
            
            if(!toggles.fires) {
                map.setLayoutProperty('nasa-fires', 'visibility', 'none');
            }
            setStatus("NASA ACTIVE FIRES SYNCHRONIZED.");
        } catch(err) {}
    };

    // ----------------------------------------------------
    // API: Weather Radar (RainViewer)
    // ----------------------------------------------------
    const fetchWeather = async () => {
        try {
            const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
            const data = await res.json();
            const latestTime = data.radar.past[data.radar.past.length - 1].path;
            
            map.addLayer({
                id: 'weather-radar',
                type: 'raster',
                source: {
                    type: 'raster',
                    // Using color scheme 2 (Titan - very colorful) and smoothing 1 so clouds jump out over the map
                    tiles: [`https://tilecache.rainviewer.com${latestTime}/256/{z}/{x}/{y}/2/1_1.png`],
                    tileSize: 256,
                    maxzoom: 15
                },
                paint: { 'raster-opacity': 0.85 }
            }, 'terminator-layer');
            
            if(!toggles.weather) {
                map.setLayoutProperty('weather-radar', 'visibility', 'none');
            }
        } catch(err) {}
    };

    // ----------------------------------------------------
    // API: ISS Tracker
    // ----------------------------------------------------
    const issSvg = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 12L12 22L22 12L12 2Z" stroke="#ffb000" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="#ffb000"/>
    </svg>`;

    const getIssPopupHtml = (alt, vel, lat, lon) => {
        // Use NASA TV YouTube channel embed instead of a fixed video ID (more stable)
        const nasaTvEmbed = 'https://www.youtube.com/embed/live_stream?channel=UCLA_DiR1FfKNvjuUpBHmylQ&autoplay=1&mute=1&rel=0';
        return `
        <div style="font-family: 'Share Tech Mono', monospace; min-width: 310px;">
            <h3 style="color: #ffb000; margin: 0 0 8px; border-bottom: 1px solid rgba(255,176,0,0.4); padding-bottom: 6px;">
                <i class="fa-solid fa-satellite"></i> ISS LIVE TELEMETRY
            </h3>
            <div style="position:relative; width:100%; padding-top:56.25%; background:#000; border: 1px solid rgba(255,176,0,0.5); margin-bottom: 8px; overflow:hidden; border-radius:2px;">
                <iframe
                    id="iss-stream-iframe"
                    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
                    src="${nasaTvEmbed}"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowfullscreen
                    title="NASA TV / ISS Earth Viewing">
                </iframe>
                <div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.8);padding:2px 8px;border-radius:2px;pointer-events:none;">
                    <span style="color:red;font-size:9px;">&#9679; LIVE</span>
                    <span style="color:#aaa;font-size:9px;margin-left:4px;">NASA TV</span>
                </div>
                <div style="position:absolute;bottom:6px;right:6px;pointer-events:none;">
                    <a href="https://www.nasa.gov/nasalive" target="_blank"
                       style="color:#ffb000;font-size:9px;text-decoration:none;background:rgba(0,0,0,.8);padding:2px 5px;border-radius:2px;">&#9654; nasa.gov/nasalive</a>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size: 0.75rem;">
                <div style="background:rgba(255,176,0,0.08);padding:4px 6px;border-radius:2px;">ALT: <span style="color:#ffb000;">${alt.toFixed(0)} KM</span></div>
                <div style="background:rgba(255,176,0,0.08);padding:4px 6px;border-radius:2px;">VEL: <span style="color:#ffb000;">${vel.toFixed(0)} KM/H</span></div>
                <div style="background:rgba(255,176,0,0.08);padding:4px 6px;border-radius:2px;">LAT: <span style="color:#0ff;">${lat.toFixed(3)}&deg;</span></div>
                <div style="background:rgba(255,176,0,0.08);padding:4px 6px;border-radius:2px;">LON: <span style="color:#0ff;">${lon.toFixed(3)}&deg;</span></div>
            </div>
            <p style="font-size:0.62rem; opacity:0.45; margin-top:6px; margin-bottom:0;">Artemis II: Crewed lunar flyby &mdash; launch 2025 &bull; <a href="https://www.nasa.gov/artemis" target="_blank" style="color:#ffb000;">nasa.gov/artemis</a></p>
        </div>
    `;};

    const fetchISS = async () => {
        try {
            const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
            const data = await response.json();
            const { latitude, longitude, velocity, altitude } = data;

            if (!issMarker) {
                const el = document.createElement('div');
                el.className = 'marker-iss';
                el.innerHTML = issSvg;
                
                issMarker = new maplibregl.Marker({ element: el })
                    .setLngLat([longitude, latitude])
                    .setPopup(new maplibregl.Popup({ offset: 25, maxWidth: '340px' })
                        .setHTML(getIssPopupHtml(altitude, velocity, latitude, longitude)));
                if (toggles.iss) issMarker.addTo(map);
            } else {
                issMarker.setLngLat([longitude, latitude]);
                // Only refresh popup HTML if not open (avoids interrupting live stream)
                if (!issMarker.getPopup().isOpen()) {
                    issMarker.getPopup().setHTML(getIssPopupHtml(altitude, velocity, latitude, longitude));
                }
            }
        } catch (error) {}
    };


    // ----------------------------------------------------
    // MOCK: STARLINK CONSTELLATION
    // ----------------------------------------------------
    const starlinkSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#00ff00" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="6"/>
    </svg>`;
    const mockStarlinkData = [];
    const starlinkMarkers = [];
    
    for(let i=0; i<150; i++) {
        mockStarlinkData.push({
            id: 'STARLINK-' + Math.floor(1000 + Math.random()*9000),
            lon: (Math.random() * 360) - 180,
            lat: (Math.random() * 180) - 90,
            hdg: 45 + (Math.random() * 10), // Mostly eastward polar orbit inclination
            spd: 0.0003 + (Math.random() * 0.0001) // Super fast LEO speed
        });
    }

    const initStarlink = () => {
        mockStarlinkData.forEach(sat => {
            const el = document.createElement('div');
            el.className = 'marker-starlink';
            el.innerHTML = starlinkSvg;
            const marker = new maplibregl.Marker({ element: el, rotation: sat.hdg })
                .setLngLat([sat.lon, sat.lat])
                .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(`
                    <h3 style="color:#00ff00;"><i class="fa-solid fa-satellite"></i> ${sat.id}</h3>
                    <p style="color:#0ff;">LOW EARTH ORBIT</p>
                    <p>STATUS: ACTIVE</p>
                `));
            sat.marker = marker;
            marker.addTo(map);
            if (!toggles.starlink) marker.getElement().style.display = 'none';
            starlinkMarkers.push(sat);
        });

        const animateStarlink = () => {
            starlinkMarkers.forEach(s => {
                s.lat += Math.cos(s.hdg * Math.PI / 180) * s.spd;
                s.lon += Math.sin(s.hdg * Math.PI / 180) * s.spd;
                if(s.lon > 180) s.lon -= 360;
                if(s.lon < -180) s.lon += 360;
                if(s.lat > 90 || s.lat < -90) s.hdg += 180; 
                if(toggles.starlink) {
                    s.marker.setLngLat([s.lon, s.lat]);
                }
            });
            requestAnimationFrame(animateStarlink);
        }
        requestAnimationFrame(animateStarlink);
    };

    // ----------------------------------------------------
    // API: Earthquakes
    // ----------------------------------------------------
    let globalEarthquakesArray = []; // Safer data access
    const fetchEarthquakes = async () => {
        setStatus("FETCHING SEISMIC DATA...");
        try {
            const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
            const data = await response.json();
            globalEarthquakesArray = data.features;
            const geojson = {
                type: 'FeatureCollection',
                features: data.features.map(f => ({
                    type: 'Feature',
                    geometry: f.geometry,
                    properties: { ...f.properties, time: new Date(f.properties.time).toLocaleTimeString() }
                }))
            };
            map.getSource('earthquakes').setData(geojson);
            map.on('click', 'earthquakes-core', (e) => {
                const p = e.features[0].properties;
                new maplibregl.Popup()
                    .setLngLat(e.lngLat)
                    .setHTML(`
                        <h3>SEISMIC EVENT</h3>
                        <p>MAG: ${p.mag}</p>
                        <p>LOC: ${p.place.toUpperCase()}</p>
                        <p>TIME: ${p.time}</p>
                    `).addTo(map);
            });
            map.on('mouseenter', 'earthquakes-core', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'earthquakes-core', () => map.getCanvas().style.cursor = '');
            setStatus("SEISMIC DATA LOADED.");
        } catch (error) {}
    };

    // ----------------------------------------------------
    // API: Live Flights
    // ----------------------------------------------------
    const planeSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#ffb000" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"/>
    </svg>`;
    
    // Command Center Simulated Global Air Traffic
    const mockFlightsData = [];
    for(let i=0; i<40; i++) {
        mockFlightsData.push({
            callsign: 'Lufthansa ' + Math.floor(100 + Math.random()*9000),
            lon: (Math.random() * 360) - 180,
            lat: (Math.random() * 140) - 70, // Avoid freezing poles
            hdg: Math.random() * 360,
            spd: 0.00008 + (Math.random() * 0.00004), // Realistic velocity curve on macro scale
            alt: Math.floor(30000 + Math.random() * 10000)
        });
    }

    const fetchFlights = () => {
        setStatus("SCANNING GLOBAL AIRSPACE...");
        
        flightMarkers.forEach(m => m.marker.remove());
        flightMarkers = [];
        
        mockFlightsData.forEach(f => {
            const el = document.createElement('div');
            el.className = 'marker-flight';
            el.innerHTML = planeSvg;
            const marker = new maplibregl.Marker({ element: el, rotation: f.hdg, rotationAlignment: 'map', pitchAlignment: 'map' })
                .setLngLat([f.lon, f.lat])
                .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`
                    <h3><i class="fa-solid fa-plane"></i> FLIGHT: ${f.callsign}</h3>
                    <p>ALT: ${f.alt} FT</p>
                    <p>SPD: ${(f.spd * 9000000).toFixed(0)} KM/H</p>
                    <p>HDG: ${Math.round(f.hdg)}&deg; TRUE</p>
                `));
            f.marker = marker;
            marker.addTo(map);
            // Always hidden until toggled on
            marker.getElement().style.display = 'none';
            flightMarkers.push(f);
        });
        
        let animationRunning = false;
        const animateAirspace = () => {
            flightMarkers.forEach(f => {
                // BUGFIX: Always move position, only control visibility via display
                f.lat += Math.cos(f.hdg * Math.PI / 180) * f.spd;
                f.lon += Math.sin(f.hdg * Math.PI / 180) * f.spd;
                
                if(f.lon > 180) f.lon -= 360;
                if(f.lon < -180) f.lon += 360;
                if(f.lat > 85 || f.lat < -85) f.hdg += 180;
                
                // Always update marker position on the map (even when invisible)
                f.marker.setLngLat([f.lon, f.lat]);
                f.marker.setRotation(f.hdg);
            });
            requestAnimationFrame(animateAirspace);
        };
        requestAnimationFrame(animateAirspace);
        setStatus("GLOBAL AIRSPACE SIMULATION LOADED.");
    };

    // ----------------------------------------------------
    // MOCK: Marine AIS (Ghost Fleet)
    // ----------------------------------------------------
    const shipSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M15 4H9L3 10V20H21V10L15 4ZM11 6H13V8H11V6ZM19 18H5V11L9.5 6L14.5 6L19 11V18Z"/>
    </svg>`;

    const fleetData = [
        { name: 'USS GERALD R. FORD', type: 'naval', cls: 'Aircraft Carrier', lat: 34.5, lon: 18.2, hdg: 45, spd: 0.00008 },
        { name: 'USS TEXAS', type: 'naval', cls: 'Submarine', lat: 36.1, lon: -5.4, hdg: 90, spd: 0.00005 },
        { name: 'EVER GIVEN', type: 'cargo', cls: 'Container Ship', lat: 31.5, lon: 32.5, hdg: 10, spd: 0.00006 },
        { name: 'MSC OSCAR', type: 'cargo', cls: 'Container Ship', lat: 48.8, lon: -6.5, hdg: 210, spd: 0.00007 },
        { name: 'HMS QUEEN ELIZABETH', type: 'naval', cls: 'Aircraft Carrier', lat: 51.5, lon: 1.5, hdg: 30, spd: 0.00009 },
        { name: 'MAERSK MC-KINNEY', type: 'cargo', cls: 'Container Ship', lat: 38.0, lon: 12.0, hdg: 300, spd: 0.00006 },
        { name: 'UNKNOWN CONTACT', type: 'naval', cls: 'Frigate (Est)', lat: 55.0, lon: 3.5, hdg: 180, spd: 0.00010 },
        { name: 'HAPAG-LLOYD', type: 'cargo', cls: 'Container Ship', lat: 43.2, lon: 5.3, hdg: 270, spd: 0.00008 },
        { name: 'FS CHARLES DE GAULLE', type: 'naval', cls: 'Aircraft Carrier', lat: 41.5, lon: 6.2, hdg: 110, spd: 0.00007 },
        { name: 'COSCO SHIPPING', type: 'cargo', cls: 'Bulk Carrier', lat: 36.8, lon: -1.2, hdg: 75, spd: 0.00005 }
    ];

    const initGhostFleet = () => {
        fleetData.forEach(ship => {
            const el = document.createElement('div');
            el.className = `marker-ship ship-${ship.type}`;
            el.innerHTML = shipSvg;
            
            const marker = new maplibregl.Marker({ element: el, rotation: ship.hdg, rotationAlignment: 'map', pitchAlignment: 'map' })
            .setLngLat([ship.lon, ship.lat])
            .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`
                <h3><i class="${ship.type === 'naval' ? 'fa-solid fa-crosshairs' : 'fa-solid fa-box'}"></i> ${ship.name}</h3>
                <p>CLASS: ${ship.cls.toUpperCase()}</p>
                <p>HDG: ${ship.hdg}&deg; TRUE</p>
                <p>SPD: ${(ship.spd * 200000).toFixed(1)} KTS</p>
            `));
            
            ship.marker = marker;
            marker.addTo(map);
            if (!toggles.ships) marker.getElement().style.display = 'none';
            shipMarkers.push(ship);
        });

        const animateShips = () => {
            shipMarkers.forEach(s => {
                s.lat += Math.cos(s.hdg * Math.PI / 180) * s.spd;
                s.lon += Math.sin(s.hdg * Math.PI / 180) * s.spd;
                if(toggles.ships) {
                    s.marker.setLngLat([s.lon, s.lat]);
                }
            });
            requestAnimationFrame(animateShips);
        }
        requestAnimationFrame(animateShips);
    };

    // ----------------------------------------------------
    // API: Live Webcams
    // ----------------------------------------------------
    // -------------------------------------------------------
    // API: Live Webcams — NASA GIBS satellite imagery per city
    // Near-real-time overhead view updated daily by NASA MODIS/VIIRS
    // -------------------------------------------------------
    const webcamData = [
        { name: 'Tokyo — Shibuya Crossing',    lat: 35.659, lon: 139.700 },
        { name: 'Dubai — Burj Khalifa Zone',   lat: 25.197, lon: 55.274 },
        { name: 'New York — Manhattan',        lat: 40.758, lon: -73.985 },
        { name: 'Paris — Eiffel Tower',        lat: 48.858, lon: 2.294  },
        { name: 'Sydney — Opera House',        lat: -33.856, lon: 151.215 },
        { name: 'Rio de Janeiro — Cristo',     lat: -22.951, lon: -43.210 },
        { name: 'Singapore — Marina Bay',      lat: 1.283,  lon: 103.860 },
        { name: 'Cairo — Giza Plateau',        lat: 29.979, lon: 31.134  },
        { name: 'London — Thames',             lat: 51.500, lon: -0.124  },
        { name: 'Hong Kong — Victoria Harbour',lat: 22.285, lon: 114.157 },
    ];

    // NASA GIBS WMS: today's MODIS Terra true-colour imagery per city
    const getGibsSatUrl = (lat, lon) => {
        const d = new Date();
        d.setDate(d.getDate() - 1); // Use yesterday to ensure data availability
        const date = d.toISOString().slice(0, 10);
        const delta = 0.5; // ~55 km bounding box
        const minLat = lat - delta, maxLat = lat + delta;
        const minLon = lon - delta, maxLon = lon + delta;
        return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg&TRANSPARENT=false&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326&STYLES=&WIDTH=512&HEIGHT=288&BBOX=${minLat},${minLon},${maxLat},${maxLon}&TIME=${date}`;
    };

    const initWebcams = () => {
        webcamData.forEach(cam => {
            const el = document.createElement('div');
            el.className = 'marker-webcam';
            el.innerHTML = '<div class="marker-webcam-inner"><i class="fa-solid fa-video"></i></div>';

            const popup = new maplibregl.Popup({ offset: 15, closeOnClick: true, maxWidth: '340px' });
            const satUrl = getGibsSatUrl(cam.lat, cam.lon);
            const d = new Date(); d.setDate(d.getDate() - 1);
            const dateStr = d.toISOString().slice(0, 10);

            popup.on('open', () => {
                popup.setHTML(`
                    <h3 style="border-bottom:1px dashed #0ff;color:#0ff;padding-bottom:5px;margin-bottom:8px;font-family:'Share Tech Mono',monospace;font-size:.85rem;">
                        <i class="fa-solid fa-satellite"></i> ${cam.name}
                    </h3>
                    <div style="position:relative;width:auto;border:1px solid rgba(0,255,255,0.3);overflow:hidden;border-radius:2px;background:#000;">
                        <img src="${satUrl}" style="display:block;width:100%;" alt="NASA satellite view"
                             onerror="this.style.display='none';this.nextSibling.style.display='block';">
                        <div style="display:none;padding:16px;text-align:center;font-family:'Share Tech Mono',monospace;color:#555;font-size:.75rem;">
                            Satellite pass not yet processed<br><span style='font-size:.6rem;'>MODIS data may have cloud cover</span>
                        </div>
                        <div style="position:absolute;top:5px;left:5px;background:rgba(0,0,0,.8);padding:2px 6px;border-radius:2px;font-family:'Share Tech Mono',monospace;font-size:9px;">
                            <span style="color:cyan;">&#9679; NASA MODIS</span>
                        </div>
                        <div style="position:absolute;top:5px;right:5px;background:rgba(0,0,0,.8);padding:2px 6px;border-radius:2px;font-family:'Share Tech Mono',monospace;font-size:9px;color:#aaa;">
                            ${dateStr}
                        </div>
                        <div style="position:absolute;bottom:5px;left:5px;background:rgba(0,0,0,.8);padding:2px 6px;border-radius:2px;font-family:'Share Tech Mono',monospace;font-size:8px;color:#0ff;">
                            ${cam.lat.toFixed(3)}&deg;N ${cam.lon.toFixed(3)}&deg;E &bull; ALT: 705 km
                        </div>
                    </div>
                    <p style="font-size:.6rem;opacity:.4;margin:4px 0 0;font-family:'Share Tech Mono',monospace;">Source: NASA GIBS / Terra MODIS &bull; 250m resolution</p>`);
            });
            popup.setHTML(`<h3><i class="fa-solid fa-satellite-dish"></i> SAT-LINK ESTABLISHING...</h3>`);

            const marker = new maplibregl.Marker({ element: el }).setLngLat([cam.lon, cam.lat]).setPopup(popup);
            marker.addTo(map);
            if (!toggles.webcams) marker.getElement().style.display = 'none';
            webcamMarkers.push(marker);
        });
    }

    // ----------------------------------------------------
    // UI Toggles
    // ----------------------------------------------------
    
    document.getElementById('toggle-all')?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const allToggles = ['toggle-borders','toggle-terminator','toggle-fires','toggle-weather','toggle-ships','toggle-flights','toggle-iss','toggle-starlink','toggle-earthquakes','toggle-webcams','toggle-nightlights','toggle-population','toggle-satellites','toggle-temperature','toggle-volcanoes','toggle-radiation','toggle-internet'];
        allToggles.forEach(id => {
            const cb = document.getElementById(id);
            if(cb && cb.checked !== isChecked) {
                cb.checked = isChecked;
                cb.dispatchEvent(new Event('change')); 
            }
        });
    });

    document.getElementById('toggle-borders')?.addEventListener('change', (e) => {
        toggles.borders = e.target.checked;
        if (map.getLayer('country-borders')) {
            map.setLayoutProperty('country-borders', 'visibility', toggles.borders ? 'visible' : 'none');
            map.setLayoutProperty('country-labels', 'visibility', toggles.borders ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-terminator')?.addEventListener('change', (e) => {
        toggles.terminator = e.target.checked;
        if (map.getLayer('terminator-layer')) {
            map.setLayoutProperty('terminator-layer', 'visibility', toggles.terminator ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-fires')?.addEventListener('change', (e) => {
        toggles.fires = e.target.checked;
        if (map.getLayer('nasa-fires')) {
            map.setLayoutProperty('nasa-fires', 'visibility', toggles.fires ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-iss')?.addEventListener('change', (e) => {
        toggles.iss = e.target.checked;
        if (issMarker) toggles.iss ? issMarker.addTo(map) : issMarker.remove();
    });

    document.getElementById('toggle-starlink')?.addEventListener('change', (e) => {
        toggles.starlink = e.target.checked;
        starlinkMarkers.forEach(s => {
            if(s.marker.getElement()) s.marker.getElement().style.display = toggles.starlink ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-earthquakes')?.addEventListener('change', (e) => {
        toggles.earthquakes = e.target.checked;
        const visibility = toggles.earthquakes ? 'visible' : 'none';
        if (map.getLayer('earthquakes-core')) {
            map.setLayoutProperty('earthquakes-core', 'visibility', visibility);
            map.setLayoutProperty('earthquakes-halo', 'visibility', visibility);
        }
    });

    document.getElementById('toggle-flights')?.addEventListener('change', (e) => {
        toggles.flights = e.target.checked;
        flightMarkers.forEach(m => {
            if(m.marker.getElement()) m.marker.getElement().style.display = toggles.flights ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-weather')?.addEventListener('change', (e) => {
        toggles.weather = e.target.checked;
        if (map.getLayer('weather-radar')) {
            map.setLayoutProperty('weather-radar', 'visibility', toggles.weather ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-ships')?.addEventListener('change', (e) => {
        toggles.ships = e.target.checked;
        shipMarkers.forEach(s => {
            if(s.marker.getElement()) s.marker.getElement().style.display = toggles.ships ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-webcams')?.addEventListener('change', (e) => {
        toggles.webcams = e.target.checked;
        webcamMarkers.forEach(m => {
            if(m.getElement()) m.getElement().style.display = toggles.webcams ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-temperature')?.addEventListener('change', (e) => {
        toggles.temperature = e.target.checked;
        if (map.getLayer('temperature')) map.setLayoutProperty('temperature', 'visibility', toggles.temperature ? 'visible' : 'none');
    });

    document.getElementById('toggle-volcanoes')?.addEventListener('change', (e) => {
        toggles.volcanoes = e.target.checked;
        volcanoMarkers.forEach(m => toggles.volcanoes ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-radiation')?.addEventListener('change', (e) => {
        toggles.radiation = e.target.checked;
        radiationMarkers.forEach(m => toggles.radiation ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-internet')?.addEventListener('change', (e) => {
        toggles.internet = e.target.checked;
        internetMarkers.forEach(m => toggles.internet ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-nightlights')?.addEventListener('change', (e) => {
        toggles.nightlights = e.target.checked;
        if (map.getLayer('night-lights')) {
            map.setLayoutProperty('night-lights', 'visibility', toggles.nightlights ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-population')?.addEventListener('change', (e) => {
        toggles.population = e.target.checked;
        if (map.getLayer('population-density')) {
            map.setLayoutProperty('population-density', 'visibility', toggles.population ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-satellites')?.addEventListener('change', (e) => {
        toggles.satellites = e.target.checked;
        satMarkers.forEach(s => {
            if(s.el) s.el.style.display = toggles.satellites ? 'block' : 'none';
        });
    });

    // ----------------------------------------------------
    // API: INTELLIGENCE CORE (V5.5)
    // ----------------------------------------------------
    const initIntelligenceCore = () => {
        // Setup Map Layers for translucent GeoJSON cluster rings
        map.addSource('intel-clusters', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        
        map.addLayer({
            id: 'intel-clusters-halo',
            type: 'circle',
            source: 'intel-clusters',
            paint: {
                'circle-radius': ['get', 'radius'],
                'circle-color': ['get', 'color'],
                'circle-opacity': 0.15,
                'circle-stroke-width': 2,
                'circle-stroke-color': ['get', 'color'],
                'circle-stroke-opacity': 0.8
            }
        });

        const alertList = document.getElementById('alert-list');
        const activeAlerts = new Set(); // Prevent spamming exact same alert

        const logAlert = (id, type, severity, msg, lat, lon) => {
            if(activeAlerts.has(id)) return;
            activeAlerts.add(id);
            setTimeout(() => activeAlerts.delete(id), 60000); // clear after 1 minute
            
            const timeStr = new Date().toLocaleTimeString();
            const el = document.createElement('div');
            el.className = `alert-item severity-${severity}`;
            el.innerHTML = `
                <h4><i class="fa-solid fa-triangle-exclamation"></i> ${type} ANOMALY</h4>
                <p>${msg}</p>
                <span class="timestamp">${timeStr} | SEC: [${lat.toFixed(2)}, ${lon.toFixed(2)}]</span>
            `;
            el.onclick = () => map.flyTo({ center: [lon, lat], zoom: 5, essential: true });
            
            alertList.prepend(el);
            if(alertList.children.length > 50) alertList.lastChild.remove();
        };

        const scanPatterns = () => {
            setStatus("AI CORE SCANNING FOR ANOMALIES...");
            let features = [];
            
            // Collect all entities
            const entities = [];
            flightMarkers.forEach(f => entities.push({type: 'Flight', lon: f.lon, lat: f.lat, ref: f.callsign}));
            shipMarkers.forEach(s => entities.push({type: 'Marine', lon: s.lon, lat: s.lat, ref: s.name}));
            
            // Loop through our safe array instead of querying map internal properties
            globalEarthquakesArray.forEach(f => {
                const coords = f.geometry.coordinates;
                if(f.properties.mag >= 4.0) { // Only track significant earthquakes
                    entities.push({type: 'Seismic', lon: coords[0], lat: coords[1], ref: f.properties.place, mag: f.properties.mag});
                }
            });

            // Simple clustering: group entities within 8 degrees of each other
            const clusters = [];
            const visited = new Set();
            
            entities.forEach((e, i) => {
                if(visited.has(i)) return;
                const cluster = [e];
                visited.add(i);
                
                entities.forEach((e2, j) => {
                    if(i === j || visited.has(j)) return;
                    const dLon = e.lon - e2.lon;
                    const dLat = e.lat - e2.lat;
                    const dist = Math.sqrt(dLon*dLon + dLat*dLat);
                    if(dist < 8) { // ~800km bounding radius
                        cluster.push(e2);
                        visited.add(j);
                    }
                });
                if(cluster.length > 1) {
                    clusters.push(cluster);
                }
            });

            // Analyze clusters for anomalies
            clusters.forEach(c => {
                // Calculate cluster centroid
                let sumLon = 0, sumLat = 0;
                let types = new Set();
                let hasHighSeismic = false;
                
                c.forEach(ent => {
                    sumLon += ent.lon;
                    sumLat += ent.lat;
                    types.add(ent.type);
                    if(ent.type === 'Seismic' && ent.mag >= 6.0) hasHighSeismic = true;
                });
                
                const cLon = sumLon / c.length;
                const cLat = sumLat / c.length;
                let severity = 'low';
                let color = '#00ff00';
                let radius = 20;
                
                const isCrossDomain = types.has('Seismic') && (types.has('Flight') || types.has('Marine'));
                
                if(c.length >= 5 || hasHighSeismic) severity = 'high';
                else if(c.length >= 3 || isCrossDomain) severity = 'medium';
                
                if(severity === 'high') { color = '#ff3300'; radius = 50; }
                else if(severity === 'medium') { color = '#ffb000'; radius = 35; }
                
                if(severity !== 'low') {
                    // Generate Narrative
                    let msg = `High density of entities detected (${c.length} objects).`;
                    let typeLabel = "DENSITY";
                    
                    if(isCrossDomain) {
                        msg = `Cross-domain correlation detected: Seismic event overlapping with ${types.has('Flight') ? 'Aviation' : 'Marine'} traffic.`;
                        typeLabel = "MULTI-DOMAIN";
                    }
                    if(hasHighSeismic) {
                        msg = `Major Seismic Event correlation zone identified. Immediate surveillance requested.`;
                        typeLabel = "CRITICAL SEISMIC";
                    }
                    
                    const clusterId = `C-${cLat.toFixed(1)}-${cLon.toFixed(1)}-${typeLabel}`;
                    logAlert(clusterId, typeLabel, severity, msg, cLat, cLon);
                    
                    features.push({
                        type: 'Feature',
                        properties: { color, radius },
                        geometry: { type: 'Point', coordinates: [cLon, cLat] }
                    });
                }
            });

            // Update Map Visuals
            map.getSource('intel-clusters').setData({
                type: 'FeatureCollection',
                features: features
            });
            
            // Clear initial loading alert if needed
            const intro = alertList.querySelector('.alert-item i.fa-satellite-dish');
            if(intro && intro.parentElement.parentElement) {
                intro.parentElement.parentElement.remove();
            }
        };

        // Run scanner every 10 seconds
        setInterval(scanPatterns, 10000);
        // Initial scan after entities load
        setTimeout(scanPatterns, 2000);
    };

    // ----------------------------------------------------
    // NASA Black Marble — Night Light Pollution
    // GIBS verified layer: VIIRS_SNPP_DayNightBand_ENCC (Level 8, PNG)
    // ----------------------------------------------------
    const fetchNightLights = () => {
        try {
            map.addSource('night-lights-src', {
                type: 'raster',
                tiles: [
                    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_DayNightBand_ENCC/default/2023-01-15/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png'
                ],
                tileSize: 256,
                maxzoom: 8,
                attribution: 'NASA VIIRS/GIBS'
            });
            map.addLayer({
                id: 'night-lights',
                type: 'raster',
                source: 'night-lights-src',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 0.9 }
            }, 'terminator-layer');
        } catch(e) { console.warn('Night lights layer error:', e.message); }
    };

    // ----------------------------------------------------
    // World Population Density -- Built-in Heatmap (CORS-free)
    // Top-100 cities with real population weights as a
    // native MapLibre heatmap layer. Zero external dependency.
    // ----------------------------------------------------
    const fetchPopulationDensity = () => {
        const cities = [
            // [lon, lat, population_millions]
            [139.69,35.69,37.4],[121.47,31.23,27.8],[116.39,39.91,21.5],[88.37,22.57,20.1],
            [72.88,19.08,20.7],[-99.13,19.43,21.7],[-46.63,-23.55,22.4],[106.85,-6.21,34.5],
            [28.95,41.01,15.3],[77.21,28.66,32.9],[126.98,37.57,9.7],[100.52,13.75,17.6],
            [103.82,1.35,5.9],[31.24,30.06,21.3],[3.39,6.45,15.3],[37.97,-1.29,5.6],
            [101.69,3.16,8.2],[120.98,14.59,14.4],[114.11,22.55,7.4],[36.81,3.24,5.5],
            [-80.13,25.78,6.2],[-73.94,40.67,18.8],[-87.63,41.88,9.6],[-118.24,34.05,18.7],
            [-122.33,37.78,7.7],[-79.38,43.65,6.8],[-43.18,-22.91,13.5],[-58.4,-34.6,15.3],
            [-77.04,38.89,6.4],[-66.86,10.49,6.7],[2.35,48.85,12.2],[13.38,52.52,6.0],
            [-0.13,51.51,9.4],[4.34,50.85,2.1],[23.72,37.98,3.8],[12.48,41.89,4.3],
            [2.17,41.39,5.3],[28.05,53.9,2.0],[37.61,55.75,12.5],[44.37,33.34,7.2],
            [51.43,35.69,16.0],[57.5,23.6,1.7],[67.09,24.86,16.1],[69.28,41.3,2.6],
            [72.99,40.37,3.8],[80.28,13.09,10.5],[85.32,27.72,1.5],[87.63,43.79,4.0],
            [88.37,22.57,14.8],[90.41,23.81,21.0],[104.06,30.65,16.0],[106.55,29.56,32.2],
            [106.71,10.77,9.0],[108.94,34.27,13.0],[112.97,28.19,8.6],[113.26,23.13,13.5],
            [114.31,30.52,11.2],[121.5,25.05,7.4],[123.45,41.8,8.1],[125.35,43.88,4.4],
            [144.96,-37.81,5.0],[151.21,-33.87,5.3],[172.63,-43.53,0.4],
            [-70.67,-33.45,7.1],[-75.51,-8.12,1.1],[-76.94,11.0,2.3],[-79.88,-2.17,2.7],
            [-77.03,-12.04,10.9],[-57.68,-25.28,4.0],[-63.18,-17.78,2.3],[-65.46,-24.79,0.7],
            [-47.93,-15.78,4.6],[-43.18,-22.91,13.5],[-48.55,-27.61,1.1]
        ];
        map.addSource('population-heatmap', {
            type: 'geojson',
            data: {
                type: 'FeatureCollection',
                features: cities.map(c => ({
                    type: 'Feature',
                    properties: { weight: c[2] },
                    geometry: { type: 'Point', coordinates: [c[0], c[1]] }
                }))
            }
        });
        map.addLayer({
            id: 'population-density',
            type: 'heatmap',
            source: 'population-heatmap',
            layout: { visibility: 'none' },
            paint: {
                'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 40, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1.5, 6, 3],
                'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 25, 4, 60, 6, 120],
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(0,0,0,0)',
                    0.1, 'rgba(0,150,255,0.3)',
                    0.3, 'rgba(0,255,150,0.5)',
                    0.5, 'rgba(255,200,0,0.7)',
                    0.8, 'rgba(255,80,0,0.85)',
                    1.0, 'rgba(255,0,0,1.0)'
                ],
                'heatmap-opacity': 0.85
            }
        }, 'terminator-layer');
    };


    // ----------------------------------------------------
    // Global Warming: MERRA-2 2m Air Temperature Monthly
    // GIBS verified layer: MERRA2_2m_Air_Temperature_Monthly
    // Max zoom: Level 6, available from 1980 to present
    // Shows global heat — warm=orange, cold=blue/purple
    // ----------------------------------------------------
    const fetchTemperatureLayer = () => {
        try {
            map.addSource('temperature-src', {
                type: 'raster',
                tiles: [
                    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MERRA2_2m_Air_Temperature_Monthly/default/2023-08-01/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png'
                ],
                tileSize: 256,
                maxzoom: 6,
                attribution: 'NASA MERRA-2 / GIBS'
            });
            map.addLayer({
                id: 'temperature',
                type: 'raster',
                source: 'temperature-src',
                layout: { visibility: 'none' },
                paint: { 'raster-opacity': 0.75 }
            }, 'terminator-layer');
        } catch(e) { console.warn('Temperature layer error:', e.message); }
    };

    // ----------------------------------------------------
    // NEW: Satellite Debris + Orbital Tracker
    // ----------------------------------------------------
    const satMarkers = [];

    const initSatelliteTracker = () => {
        const satClasses = [
            // GEO belt — Fixed at 35,786 km, equatorial ring
            ...Array.from({ length: 60 }, (_, i) => ({
                type: 'GEO', name: `GEO-${1000 + i}`,
                lon: -180 + (i * 6),
                lat: (Math.random() - 0.5) * 2, // Nearly equatorial
                hdg: 90,
                spd: 0, // Stationary
                alt: '35,786 km',
                color: '#00ffff'
            })),
            // MEO belt — GPS/Galileo, ~20,000 km, polar-ish
            ...Array.from({ length: 80 }, (_, i) => ({
                type: 'MEO', name: `GPS-${2000 + i}`,
                lon: (Math.random() * 360) - 180,
                lat: (Math.random() * 110) - 55,
                hdg: 45 + (Math.random() * 90),
                spd: 0.00015 + Math.random() * 0.00005,
                alt: '20,200 km',
                color: '#ffb000'
            })),
            // LEO — Debris & ISS-class, ~400-2000 km, all inclinations
            ...Array.from({ length: 220 }, (_, i) => ({
                type: 'LEO', name: `OBJ-${3000 + i}`,
                lon: (Math.random() * 360) - 180,
                lat: (Math.random() * 160) - 80,
                hdg: Math.random() * 360,
                spd: 0.0004 + Math.random() * 0.0002,
                alt: `${Math.floor(400 + Math.random() * 1600)} km`,
                color: 'rgba(255,255,255,0.7)'
            }))
        ];

        satClasses.forEach(sat => {
            const el = document.createElement('div');
            el.style.cssText = `
                width: 4px; height: 4px;
                background: ${sat.color};
                border-radius: 50%;
                box-shadow: 0 0 4px ${sat.color};
                position: absolute;
                cursor: pointer;
                transition: transform 0.1s;
            `;
            el.title = `${sat.name} [${sat.type}] — ALT: ${sat.alt}`;

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([sat.lon, sat.lat])
                .setPopup(new maplibregl.Popup({ offset: 8 }).setHTML(`
                    <h3 style="color:${sat.color};"><i class="fa-solid fa-satellite"></i> ${sat.name}</h3>
                    <p>CLASS: ${sat.type} ORBIT</p>
                    <p>ALT: ${sat.alt}</p>
                    <p>STATUS: <span style="color:#00ff00;">TRACKED</span></p>
                `))
                .addTo(map);

            el.style.display = 'none'; // Hidden until toggled
            sat.el = el;
            sat.marker = marker;
            satMarkers.push(sat);
        });

        const animateSats = () => {
            satMarkers.forEach(s => {
                if (s.spd > 0) {
                    s.lat += Math.cos(s.hdg * Math.PI / 180) * s.spd;
                    s.lon += Math.sin(s.hdg * Math.PI / 180) * s.spd;
                    if (s.lon > 180) s.lon -= 360;
                    if (s.lon < -180) s.lon += 360;
                    if (s.lat > 85 || s.lat < -85) s.hdg += 180;
                }
                // Always update position (visibility via display style)
                s.marker.setLngLat([s.lon, s.lat]);
            });
            requestAnimationFrame(animateSats);
        };
        requestAnimationFrame(animateSats);
        setStatus('ORBITAL SURVEILLANCE NETWORK ONLINE.');
    };

    setInterval(() => {
        if(statusText.innerText.includes("UPDATED") || statusText.innerText.includes("LOADED") || statusText.innerText.includes("ESTABLISHED") || statusText.innerText.includes("SYNCHRONIZED") || statusText.innerText.includes("ONLINE")) {
            setStatus("SYSTEM NOMINAL // RECEIVING UPLINK");
        }
    }, 5000);

    // ============================================================
    // 1. ACTIVE VOLCANOES (Smithsonian GVP curated list)
    // ============================================================
    const volcanoMarkers = [];
    const LEVEL_COLORS = { 'ERUPTION': '#ff0000', 'WARNING': '#ff6600', 'WATCH': '#ffb000', 'ONGOING': '#ff4400', 'ADVISORY': '#ffe000' };
    const VOLCANOES = [
        { name: 'Reykjanes', lat: 63.87, lon: -22.56, country: 'Iceland', level: 'ERUPTION', desc: 'Active fissure eruption since 2023' },
        { name: 'Ruang', lat: 2.30, lon: 125.37, country: 'Indonesia', level: 'ERUPTION', desc: 'Major explosive eruption 2024' },
        { name: 'Etna', lat: 37.75, lon: 14.99, country: 'Italy', level: 'ONGOING', desc: 'Ongoing lava flows & paroxysms' },
        { name: 'Stromboli', lat: 38.79, lon: 15.21, country: 'Italy', level: 'ONGOING', desc: 'Persistent strombolian activity' },
        { name: 'Kilauea', lat: 19.42, lon: -155.29, country: 'USA (Hawaii)', level: 'WATCH', desc: 'Caldera lava lake activity' },
        { name: 'Sakurajima', lat: 31.58, lon: 130.66, country: 'Japan', level: 'ONGOING', desc: 'Frequent explosions & ashfall' },
        { name: 'Suwanosejima', lat: 29.64, lon: 129.72, country: 'Japan', level: 'ONGOING', desc: 'Continuous eruption column' },
        { name: 'Popocatepetl', lat: 19.02, lon: -98.28, country: 'Mexico', level: 'WARNING', desc: 'Increased seismicity & gas flux' },
        { name: 'Sabancaya', lat: -15.78, lon: -71.86, country: 'Peru', level: 'WARNING', desc: 'Continuous ash plumes' },
        { name: 'Sangay', lat: -2.00, lon: -78.34, country: 'Ecuador', level: 'ONGOING', desc: 'Persistent lava flows & bombs' },
        { name: 'Nyiragongo', lat: -1.52, lon: 29.25, country: 'DR Congo', level: 'WARNING', desc: 'Active lava lake; risk of flank eruption' },
        { name: 'Piton de la Fournaise', lat: -21.23, lon: 55.71, country: 'Reunion Isl.', level: 'ONGOING', desc: 'Lava flows to coast' },
        { name: 'Sinabung', lat: 3.17, lon: 98.39, country: 'Indonesia', level: 'WARNING', desc: 'Lava dome; pyroclastic flows possible' },
        { name: 'Merapi', lat: -7.54, lon: 110.44, country: 'Indonesia', level: 'WARNING', desc: 'Dome growth; exclusion zone active' },
        { name: 'Semeru', lat: -8.11, lon: 112.92, country: 'Indonesia', level: 'WARNING', desc: 'Continuous eruption & pyroclastic flows' },
        { name: 'Ibu', lat: 1.49, lon: 127.63, country: 'Indonesia', level: 'ONGOING', desc: 'Explosion earthquakes daily' },
        { name: 'Dukono', lat: 1.68, lon: 127.88, country: 'Indonesia', level: 'ONGOING', desc: 'Persistent ash-laden plumes' },
        { name: 'Erebus', lat: -77.53, lon: 167.15, country: 'Antarctica', level: 'ONGOING', desc: 'Permanent lava lake in crater' },
        { name: 'Shiveluch', lat: 56.65, lon: 161.36, country: 'Russia', level: 'WARNING', desc: 'Explosive activity & dome growth' },
        { name: 'Bezymianny', lat: 55.98, lon: 160.59, country: 'Russia', level: 'WARNING', desc: 'Lava dome extrusion & ash' },
        { name: 'Fuego', lat: 14.47, lon: -90.88, country: 'Guatemala', level: 'ONGOING', desc: 'Lava flows & ballistic projectiles' },
        { name: 'Pacaya', lat: 14.38, lon: -90.60, country: 'Guatemala', level: 'ONGOING', desc: 'Strombolian activity' },
        { name: 'Nevado del Ruiz', lat: 4.89, lon: -75.32, country: 'Colombia', level: 'WARNING', desc: 'Lahars possible; elevated seismicity' },
        { name: 'Taal', lat: 14.00, lon: 120.99, country: 'Philippines', level: 'WARNING', desc: 'Elevated SO2 emissions' },
        { name: 'Yasur', lat: -19.53, lon: 169.44, country: 'Vanuatu', level: 'ONGOING', desc: 'Continuous strombolian activity' },
        { name: 'Kadovar', lat: -3.62, lon: 144.87, country: 'Papua New Guinea', level: 'ONGOING', desc: 'Steam & ash venting' },
        { name: 'Krakatau', lat: -6.10, lon: 105.42, country: 'Indonesia', level: 'ADVISORY', desc: 'Periodic eruptions & sea disturbance' },
        { name: 'Grimsvotn', lat: 64.42, lon: -17.33, country: 'Iceland', level: 'ADVISORY', desc: 'Subsurface activity increasing' },
        { name: 'White Island', lat: -37.52, lon: 177.18, country: 'New Zealand', level: 'ADVISORY', desc: 'Ongoing hydrothermal activity' },
        { name: 'Suwanose-jima', lat: 29.64, lon: 129.72, country: 'Japan', level: 'WATCH', desc: 'Sporadic strombolian activity' },
    ];

    const initVolcanoes = () => {
        VOLCANOES.forEach(v => {
            const c = LEVEL_COLORS[v.level] || '#ff4400';
            const el = document.createElement('div');
            el.style.cssText = `width:13px;height:13px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:radial-gradient(circle,${c},#200);border:1px solid ${c};box-shadow:0 0 8px 3px ${c}88;cursor:pointer;`;
            const popup = new maplibregl.Popup({ offset: 14, maxWidth: '260px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;">
                <h3 style="color:#ff5500;margin:0 0 6px;border-bottom:1px solid #ff5500;padding-bottom:4px;">🌋 ${v.name}</h3>
                <p style="margin:2px 0;font-size:.8rem;">📍 ${v.country}</p>
                <p style="margin:4px 0;font-size:.8rem;">Status: <strong style="color:${c};">${v.level}</strong></p>
                <p style="margin:4px 0;font-size:.75rem;opacity:.85;">${v.desc}</p>
                <p style="font-size:.62rem;opacity:.45;margin-top:6px;">Source: Smithsonian GVP</p></div>`);
            const m = new maplibregl.Marker({ element: el }).setLngLat([v.lon, v.lat]).setPopup(popup);
            volcanoMarkers.push(m);
            if (toggles.volcanoes) m.addTo(map);
        });
        setStatus('VOLCANIC THREAT MATRIX LOADED.');
    };

    // ============================================================
    // 2. RADIATION HOTSPOTS (Safecast + known nuclear sites)
    // ============================================================
    const radiationMarkers = [];
    const RADIATION_SITES = [
        { name: 'Chernobyl Exclusion Zone', lat: 51.39, lon: 30.09, uSv: 1.8, level: 'HIGH', desc: 'Nuclear disaster site 1986, Ukraine' },
        { name: 'Fukushima Daiichi', lat: 37.42, lon: 141.03, uSv: 0.9, level: 'ELEVATED', desc: 'Nuclear disaster site 2011, Japan' },
        { name: 'Zaporizhzhia NPP', lat: 47.51, lon: 34.58, uSv: 0.3, level: 'CAUTION', desc: 'Under military control since 2022' },
        { name: 'Semipalatinsk Test Site', lat: 50.07, lon: 78.43, uSv: 0.5, level: 'ELEVATED', desc: 'Soviet nuclear test site, Kazakhstan (456 tests)' },
        { name: 'Nevada Test Site', lat: 37.12, lon: -116.05, uSv: 0.38, level: 'MODERATE', desc: 'US nuclear test site (928 tests), Nevada' },
        { name: 'Novaya Zemlya', lat: 73.5, lon: 54.9, uSv: 0.42, level: 'MODERATE', desc: 'Soviet Arctic nuclear test archipelago' },
        { name: 'Bikini Atoll', lat: 11.50, lon: 165.50, uSv: 0.16, level: 'LOW', desc: 'US nuclear tests 1946-1958, Marshall Islands' },
        { name: 'Hanford Site', lat: 46.65, lon: -119.65, uSv: 0.28, level: 'MODERATE', desc: 'Largest US nuclear waste site, Washington' },
        { name: 'Los Alamos', lat: 35.88, lon: -106.29, uSv: 0.14, level: 'MONITORING', desc: 'National nuclear research lab, New Mexico' },
        { name: 'Sellafield', lat: 54.42, lon: -3.50, uSv: 0.22, level: 'MONITORING', desc: 'Nuclear reprocessing plant, UK' },
        { name: 'La Hague', lat: 49.68, lon: -1.88, uSv: 0.18, level: 'MONITORING', desc: 'Nuclear reprocessing plant, France' },
        { name: 'Mayak Plant', lat: 55.71, lon: 60.85, uSv: 0.55, level: 'ELEVATED', desc: '1957 Kyshtym nuclear disaster site, Russia' },
    ];
    
    const RAD_COLORS = { HIGH: '#ff0000', ELEVATED: '#ff6600', CAUTION: '#ffb000', MODERATE: '#ffe000', LOW: '#00ff88', MONITORING: '#00aaff' };

    const initRadiationSites = () => {
        RADIATION_SITES.forEach(r => {
            const c = RAD_COLORS[r.level] || '#00ff88';
            const el = document.createElement('div');
            el.style.cssText = `width:14px;height:14px;border-radius:50%;background:radial-gradient(circle,${c}88,transparent);border:1px solid ${c};box-shadow:0 0 10px 4px ${c}55;cursor:pointer;animation:pulse-ring 2s infinite;`;
            const popup = new maplibregl.Popup({ offset: 14, maxWidth: '270px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;">
                <h3 style="color:${c};margin:0 0 6px;border-bottom:1px solid ${c}88;padding-bottom:4px;">☢ ${r.name}</h3>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:.77rem;">
                    <div style="background:rgba(255,100,0,.1);padding:4px 6px;border-radius:2px;">LEVEL: <strong style="color:${c};">${r.level}</strong></div>
                    <div style="background:rgba(255,100,0,.1);padding:4px 6px;border-radius:2px;">μSv/h: <strong style="color:${c};">${r.uSv}</strong></div>
                </div>
                <p style="margin:6px 0 0;font-size:.73rem;opacity:.8;">${r.desc}</p>
                <p style="font-size:.6rem;opacity:.4;margin-top:6px;">Source: Safecast / IAEA</p></div>`);
            const m = new maplibregl.Marker({ element: el }).setLngLat([r.lon, r.lat]).setPopup(popup);
            radiationMarkers.push(m);
            if (toggles.radiation) m.addTo(map);
        });
        setStatus('RADIATION MONITORING NETWORK ACTIVE.');
    };

    // ============================================================
    // 3. SOLAR STORM INDEX (NOAA SWPC — using reliable 3h Kp endpoint)
    // ============================================================
    const solarHud = document.getElementById('solar-hud');

    const getSolarColor = (kp) => {
        if (kp >= 8) return '#ff0000';
        if (kp >= 6) return '#ff6600';
        if (kp >= 4) return '#ffb000';
        if (kp >= 2) return '#00ff88';
        return '#00aaff';
    };

    const fetchSolarStorm = async () => {
        try {
            // Primary: NOAA planetary Kp 3h dataset (robust, always returns data)
            const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
            const kpRaw = await kpRes.json();
            // Format: [ ["time_tag","Kp","a","station_count"], [time, kp, a, n], ... ]
            const lastRow = kpRaw[kpRaw.length - 1];
            const kp = parseFloat(Array.isArray(lastRow) ? lastRow[1] : 0) || 0;

            // Solar wind (optional, may return nulls when ACE satellite has data gaps)
            let windSpeed = '--', bz = '--';
            try {
                const windRes = await fetch('https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json');
                const windData = await windRes.json();
                // Find most recent row with valid data
                const validWind = [...windData].reverse().find(w => w.speed != null && w.speed > 0);
                if (validWind) {
                    windSpeed = Math.round(validWind.speed);
                    bz = validWind.bz_gsm != null ? validWind.bz_gsm.toFixed(1) : '--';
                }
            } catch(_) {}

            const color = getSolarColor(kp);
            const level = kp >= 8 ? 'EXTREME' : kp >= 7 ? 'SEVERE' : kp >= 6 ? 'STRONG' : kp >= 5 ? 'MODERATE' : kp >= 4 ? 'MINOR' : kp >= 2 ? 'QUIET' : 'CALM';

            if (solarHud) {
                solarHud.style.borderColor = color + '80';
                solarHud.innerHTML = `
                    <div style="color:${color};font-size:.6rem;letter-spacing:2px;margin-bottom:4px;">&#9728; SOLAR STORM INDEX</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;font-size:.68rem;">
                        <div style="text-align:center;"><div style="color:${color};font-size:1.2rem;font-weight:bold;">${kp.toFixed(1)}</div><div style="opacity:.5;font-size:.55rem;">Kp INDEX</div></div>
                        <div style="text-align:center;"><div style="color:#0ff;font-size:1.2rem;">${windSpeed}</div><div style="opacity:.5;font-size:.55rem;">km/s WIND</div></div>
                        <div style="text-align:center;"><div style="color:${(parseFloat(bz)||0) < 0 ? '#ff6600' : '#00ff88'};font-size:1.2rem;">${bz}</div><div style="opacity:.5;font-size:.55rem;">Bz nT</div></div>
                    </div>
                    <div style="text-align:center;margin-top:4px;color:${color};font-size:.6rem;letter-spacing:1px;">${level} GEOMAGNETIC ACTIVITY</div>
                    ${kp >= 5 ? '<div style="color:#ffb000;font-size:.58rem;text-align:center;">&#9888; AURORA ALERT &mdash; HIGH LATITUDES</div>' : ''}
                `;
            }
            // Aurora oval at Kp >= 4
            if (kp >= 4) {
                const aurLat = 90 - (kp * 3.5);
                if (!map.getSource('aurora-src')) {
                    const ring = [];
                    for (let i = 0; i <= 361; i++) ring.push([i - 180, aurLat]);
                    map.addSource('aurora-src', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } } });
                    map.addLayer({ id: 'aurora-ring', type: 'line', source: 'aurora-src', paint: { 'line-color': '#00ff88', 'line-width': 2, 'line-opacity': 0.6, 'line-dasharray': [4, 4] } });
                }
            }
        } catch(e) {
            if (solarHud) solarHud.innerHTML = '<div style="color:#555;font-size:.62rem;">&#9728; SOLAR: NOAA LINK TIMEOUT</div>';
        }
    };

    // ============================================================
    // 4. INTERNET OUTAGES (IODA — public API)
    // ============================================================
    const internetMarkers = [];
    const COUNTRY_CAPITALS = {
        'RU': [37.61, 55.75], 'CN': [116.39, 39.91], 'US': [-77.04, 38.89],
        'UA': [30.52, 50.45], 'IR': [51.43, 35.69], 'KP': [125.74, 39.02],
        'BY': [27.57, 53.90], 'MM': [96.15, 19.74], 'CU': [-82.37, 23.13],
        'SY': [36.30, 33.51], 'ET': [38.73, 9.02], 'AF': [69.17, 34.52],
        'IQ': [44.37, 33.34], 'SD': [32.53, 15.56], 'TR': [32.87, 39.93],
        'PK': [73.04, 33.72], 'MX': [-99.13, 19.43], 'BD': [90.41, 23.81],
        'NG': [7.48, 9.08], 'IN': [77.21, 28.66], 'BR': [-47.93, -15.78],
        'ID': [106.82, -6.17], 'KZ': [71.45, 51.18], 'LY': [13.18, 32.90]
    };

    const fetchInternetOutages = async () => {
        try {
            const res = await fetch('https://api.ioda.inetintel.cc.gatech.edu/v2/alerts?from=-86400&format=json');
            const data = await res.json();
            internetMarkers.forEach(m => m.remove());
            internetMarkers.length = 0;
            const alerts = Array.isArray(data?.data?.alerts) ? data.data.alerts : [];
            const seen = new Set();
            alerts.slice(0, 20).forEach(alert => {
                const code = alert?.entity?.code?.toUpperCase();
                if (!code || seen.has(code) || !COUNTRY_CAPITALS[code]) return;
                seen.add(code);
                const [lon, lat] = COUNTRY_CAPITALS[code];
                const severity = alert.level || 'low';
                const color = severity === 'critical' ? '#ff0000' : severity === 'warning' ? '#ff6600' : '#ffb000';
                const el = document.createElement('div');
                el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color}44;border:1px solid ${color};box-shadow:0 0 10px 4px ${color}55;cursor:pointer;animation:pulse-ring 1.5s infinite;`;
                const popup = new maplibregl.Popup({ offset: 14, maxWidth: '250px' }).setHTML(`
                    <div style="font-family:'Share Tech Mono',monospace;">
                    <h3 style="color:${color};margin:0 0 6px;border-bottom:1px solid ${color}55;padding-bottom:4px;">🌐 INTERNET DISRUPTION</h3>
                    <p style="font-size:.8rem;margin:2px 0;">Country: <strong>${alert?.entity?.name || code}</strong></p>
                    <p style="font-size:.8rem;margin:2px 0;">Severity: <strong style="color:${color};">${severity.toUpperCase()}</strong></p>
                    <p style="font-size:.72rem;opacity:.7;margin-top:4px;">BGP routing anomaly detected</p>
                    <p style="font-size:.6rem;opacity:.4;margin-top:4px;">Source: IODA / Georgia Tech</p></div>`);
                const m = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).setPopup(popup);
                internetMarkers.push(m);
                if (toggles.internet) m.addTo(map);
            });
            if (seen.size === 0) {
                setStatus('INTERNET: NO ANOMALIES DETECTED.');
            } else {
                setStatus(`INTERNET: ${seen.size} ROUTING ANOMALIES DETECTED.`);
            }
        } catch(e) {
            setStatus('INTERNET FEED: SIGNAL LOST.');
        }
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
            const res = await fetch('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=4&format=json');
            const data = await res.json();
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
                    <div style="color:#ff9955;">${icon} ${name.length > 28 ? name.slice(0,27)+'…' : name}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:2px;">
                        <span style="opacity:.55;">${rocket}</span>
                        ${countdown}
                    </div>
                    ${pad ? `<div style="opacity:.35;font-size:.58rem;">${pad}</div>` : ''}
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
            type: 'Civil War → Transition', since: 2011,
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
            parties: [['🇮🇱 Israel', 'Military operation in S. Lebanon'], ['Hezbollah (Iran-backed)', 'Dominant armed group']],
            support: 'Hezbollah: Iran (weapons, money). Israel: US military aid.',
            casualties: '>4,000 dead in Lebanon-Israel fighting, 2024; ~1,200 Hezbollah fighters',
            displaced: '~1.2M displaced in Lebanon during conflict',
            status: 'CEASEFIRE (Nov 2024) — Fragile; Hezbollah rebuilt; IDF partial withdrawal',
            note: 'Full escalation Jun-Nov 2024. Ceasefire Nov 27, 2024. Hezbollah severely weakened (Nasrallah killed).'
        },
        {
            name: 'Pakistan — TTP Insurgency', lat: 33.0, lon: 70.5, severity: 'MODERATE',
            type: 'Islamist Insurgency', since: 2007,
            parties: [['🇵🇰 Pakistan Army', 'Federal security forces'], ['TTP (Tehrik-i-Taliban)', 'Taliban-linked insurgency']],
            support: 'Pakistan: Chinese military cooperation. TTP: Afghan Taliban support.',
            casualties: '>80,000 dead (2007-present, all causes)',
            displaced: '>500,000 IDPs in KPK/FATA regions',
            status: 'ESCALATING — TTP attacks surged 70% since Afghan Taliban takeover 2021',
            note: 'TTP attacks dramatically increased after Afghan Taliban return to power in 2021. Safe haven in Afghanistan.'
        },
        {
            name: 'Nagorno-Karabakh Aftermath', lat: 40.2, lon: 46.8, severity: 'MODERATE',
            type: 'Post-Conflict Ethnic Cleansing / Tensions', since: 1988,
            parties: [['🇦🇿 Azerbaijan', 'Retook NKR Sept 2023'], ['🇦🇲 Armenia', 'Ceded NKR; border demarcation ongoing']],
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

            const popup = new maplibregl.Popup({ offset: 14, maxWidth: '320px' }).setHTML(`
                <div style="font-family:'Share Tech Mono',monospace;font-size:.72rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;border-bottom:1px solid ${col}44;padding-bottom:5px;">
                    <h3 style="color:${col};margin:0;font-size:.85rem;">&#9881; ${c.name}</h3>
                    <span style="background:${col}22;border:1px solid ${col}55;color:${col};padding:1px 5px;font-size:.6rem;border-radius:2px;">${c.severity}</span>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:7px;">
                    <div style="background:rgba(255,255,255,.04);padding:3px 6px;">TYPE<br><strong style="font-size:.75rem;">${c.type}</strong></div>
                    <div style="background:rgba(255,255,255,.04);padding:3px 6px;">SINCE<br><strong style="font-size:.75rem;">${c.since} (${duration} yr${duration !== 1 ? 's' : ''})</strong></div>
                </div>
                <div style="font-size:.62rem;opacity:.5;margin-bottom:3px;letter-spacing:1px;">&#9876; PARTIES IN CONFLICT</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:7px;">${partiesHtml}</div>
                <div style="font-size:.62rem;opacity:.5;margin-bottom:2px;letter-spacing:1px;">&#9679; EXTERNAL SUPPORT</div>
                <div style="background:rgba(255,255,255,.03);padding:4px 6px;margin-bottom:6px;font-size:.68rem;opacity:.85;">${c.support}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:6px;">
                    <div><div style="font-size:.58rem;opacity:.5;letter-spacing:1px;">EST. CASUALTIES</div><div style="color:#ff6655;font-size:.68rem;margin-top:1px;">${c.casualties}</div></div>
                    <div><div style="font-size:.58rem;opacity:.5;letter-spacing:1px;">DISPLACED</div><div style="color:#ffb000;font-size:.68rem;margin-top:1px;">${c.displaced}</div></div>
                </div>
                <div style="font-size:.62rem;opacity:.5;margin-bottom:2px;letter-spacing:1px;">&#9679; CURRENT STATUS</div>
                <div style="background:${col}11;border:1px solid ${col}33;padding:4px 7px;font-size:.7rem;color:${col};margin-bottom:5px;">${c.status}</div>
                <div style="font-size:.65rem;opacity:.65;border-top:1px solid rgba(255,255,255,.08);padding-top:5px;line-height:1.4;">${c.note}</div>
                <div style="font-size:.55rem;opacity:.3;margin-top:5px;">Source: ACLED / SIPRI / UN OCHA / SOHR 2025</div>
                </div>`);

            const m = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([c.lon, c.lat])
                .setPopup(popup);
            conflictMarkers.push(m);
            if (toggles.conflicts) m.addTo(map);
        });
        setStatus('CONFLICT ZONE DATABASE LOADED.');
    };

    document.getElementById('toggle-conflicts')?.addEventListener('change', (e) => {
        toggles.conflicts = e.target.checked;
        conflictMarkers.forEach(m => toggles.conflicts ? m.addTo(map) : m.remove());
    });

});
