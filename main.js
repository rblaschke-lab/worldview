document.addEventListener("DOMContentLoaded", () => {
    // 1. Mobile Menu Hamburger Toggle Logic
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.getElementById('sidebar');
    if(mobileBtn && sidebar) {
        mobileBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

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
                maxzoom: 22
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
        terminator: false, fires: false, weather: false,
        ships: false, flights: false, iss: false, earthquakes: false, webcams: false
    };

    map.on('load', () => {
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
                    1.0, 1,    // < 4.0
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
        fetchISS();
        setInterval(fetchISS, 5000);
        fetchEarthquakes();
        fetchFlights();
        initGhostFleet();
        initWebcams();
        
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
        try {
            // NASA GIBS tiles are typically 24-48 hours behind real time.
            const pastDate = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
            
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
            }setStatus("NASA ACTIVE FIRES SYNCHRONIZED.");
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
                    .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`
                        <h3>ORBITAL: ISS</h3>
                        <p>ALT: ${altitude.toFixed(0)} KM</p>
                        <p>VEL: ${velocity.toFixed(0)} KM/H</p>
                    `));
                if (toggles.iss) issMarker.addTo(map);
            } else {
                issMarker.setLngLat([longitude, latitude]);
                issMarker.getPopup().setHTML(`
                    <h3>ORBITAL: ISS</h3>
                    <p>ALT: ${altitude.toFixed(0)} KM</p>
                    <p>VEL: ${velocity.toFixed(0)} KM/H</p>
                `);
            }
        } catch (error) {}
    };

    // ----------------------------------------------------
    // API: Earthquakes
    // ----------------------------------------------------
    const fetchEarthquakes = async () => {
        setStatus("FETCHING SEISMIC DATA...");
        try {
            const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
            const data = await response.json();
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
            spd: 0.00003 + (Math.random() * 0.00002), // CORRECT SPEED (not 70,000 km/h)
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
                    <p>SPD: ${(f.spd * 8000000).toFixed(0)} KM/H</p>
                `));
            f.marker = marker;
            if (toggles.flights) marker.addTo(map);
            flightMarkers.push(f);
        });
        
        const animateAirspace = () => {
            flightMarkers.forEach(f => {
                f.lat += Math.cos(f.hdg * Math.PI / 180) * f.spd;
                f.lon += Math.sin(f.hdg * Math.PI / 180) * f.spd;
                
                if(f.lon > 180) f.lon -= 360;
                if(f.lon < -180) f.lon += 360;
                if(f.lat > 85 || f.lat < -85) f.hdg += 180; 
                
                if (toggles.flights) {
                    f.marker.setLngLat([f.lon, f.lat]);
                    // update internal marker rotation explicitly because MapLibre CSS rotation must match
                    f.marker.setRotation(f.hdg);
                }
            });
            requestAnimationFrame(animateAirspace);
        }
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
            if (toggles.ships) marker.addTo(map);
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
    const webcamData = [
        // Global Highlight Cams
        { name: 'Jackson Hole, WY', img: 'https://images.unsplash.com/photo-1618083811566-f40c749b5ae7?w=800&q=90', lat: 43.4799, lon: -110.7624 },
        { name: 'NASA ISS Live Feed', img: 'https://images.unsplash.com/photo-1614729939124-032f0b56c9ce?w=800&q=90', lat: 28.3922, lon: -80.6077 },
        { name: 'Abbey Road, London', img: 'https://images.unsplash.com/photo-1513635269975-59693e2d8ce2?w=800&q=90', lat: 51.5321, lon: -0.1773 },
        { name: 'Venice Grand Canal', img: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=90', lat: 45.4383, lon: 12.3364 },
        
        // --- DEEP DIVE DEMO CLUSTER: NEW YORK CITY ---
        { name: 'Times Square Central', img: 'https://images.unsplash.com/photo-1500916434205-0c77489c6cf7?w=800&q=90', lat: 40.7580, lon: -73.9855 },
        { name: 'Brooklyn Bridge Approach', img: 'https://images.unsplash.com/photo-1505295556276-88abeb7e31b6?w=800&q=90', lat: 40.7061, lon: -73.9969 },
        { name: 'Central Park South', img: 'https://images.unsplash.com/photo-1522083165195-3424ed129620?w=800&q=90', lat: 40.7643, lon: -73.9730 },
        { name: 'Wall Street Exchange', img: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800&q=90', lat: 40.7075, lon: -74.0113 },
        { name: 'Statue of Liberty Perimeter', img: 'https://images.unsplash.com/photo-1605130284535-11dd9eedc58a?w=800&q=90', lat: 40.6892, lon: -74.0445 }
    ];

    const initWebcams = () => {
        webcamData.forEach(cam => {
            const el = document.createElement('div');
            el.className = 'marker-webcam';
            el.innerHTML = '<div class="marker-webcam-inner"><i class="fa-solid fa-video"></i></div>';
            
            const popup = new maplibregl.Popup({ offset: 15, closeOnClick: true, maxWidth: '320px' });
            
            // FAKED SECURITY CCTV FEED OVERLAY (Instead of broken YouTube iframes)
            const timeObj = new Date();
            const timeStr = timeObj.toISOString().replace('T', ' ').substring(0, 19) + " Z";
            
            popup.on('open', () => {
                popup.setHTML(`
                    <h3 style="border-bottom: 1px dashed #00ff00; color: #00ff00; padding-bottom: 5px; margin-bottom: 10px;">
                        <i class="fa-solid fa-satellite-dish"></i> ${cam.name}
                    </h3>
                    <div style="position:relative; width:300px; height:170px; border: 1px solid rgba(0,255,0,0.5); overflow: hidden; background: #000;">
                        <!-- Clear-View Mod: Removed CSS hue/sepia filters for perfect RGB colors & resolution -->
                        <img src="${cam.img}" style="display:block; width:100%; height:100%; object-fit: cover;">
                        <div style="position:absolute; top:8px; left:8px; color:red; font-weight:bold; font-family:monospace; animation: blink 1s infinite; text-shadow: 1px 1px 2px black;">
                            <span style="display:inline-block; width:8px; height:8px; background:red; border-radius:50%; margin-right:4px;"></span>REC
                        </div>
                        <div style="position:absolute; bottom:8px; left:8px; color:#00ff00; font-family:monospace; font-size:10px; background:rgba(0,0,0,0.7); padding:3px; border-radius: 2px;">
                            HD CAM: ACTIVE
                        </div>
                        <div style="position:absolute; top:8px; right:8px; color:#00ff00; font-family:monospace; font-size:10px; text-shadow: 1px 1px 2px black; background:rgba(0,0,0,0.7); padding:3px; border-radius: 2px;">
                            ${timeStr}
                        </div>
                    </div>
                `);
            });
            
            // No need for close handler since it re-applies innerHTML on open
            popup.setHTML(`<h3><i class="fa-solid fa-satellite-dish"></i> SAT-LINK ESTABLISHING...</h3>`);

            const marker = new maplibregl.Marker({ element: el })
                .setLngLat([cam.lon, cam.lat])
                .setPopup(popup);

            if (toggles.webcams) marker.addTo(map);
            webcamMarkers.push(marker);
        });
    }

    // ----------------------------------------------------
    // UI Toggles
    // ----------------------------------------------------
    
    document.getElementById('toggle-all').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const allToggles = ['toggle-terminator', 'toggle-fires', 'toggle-weather', 'toggle-ships', 'toggle-flights', 'toggle-iss', 'toggle-earthquakes', 'toggle-webcams'];
        allToggles.forEach(id => {
            const cb = document.getElementById(id);
            if(cb && cb.checked !== isChecked) {
                cb.checked = isChecked;
                cb.dispatchEvent(new Event('change')); 
            }
        });
    });

    document.getElementById('toggle-terminator').addEventListener('change', (e) => {
        toggles.terminator = e.target.checked;
        if (map.getLayer('terminator-layer')) {
            map.setLayoutProperty('terminator-layer', 'visibility', toggles.terminator ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-fires').addEventListener('change', (e) => {
        toggles.fires = e.target.checked;
        if (map.getLayer('nasa-fires')) {
            map.setLayoutProperty('nasa-fires', 'visibility', toggles.fires ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-iss').addEventListener('change', (e) => {
        toggles.iss = e.target.checked;
        if (issMarker) toggles.iss ? issMarker.addTo(map) : issMarker.remove();
    });

    document.getElementById('toggle-earthquakes').addEventListener('change', (e) => {
        toggles.earthquakes = e.target.checked;
        const visibility = toggles.earthquakes ? 'visible' : 'none';
        if (map.getLayer('earthquakes-core')) {
            map.setLayoutProperty('earthquakes-core', 'visibility', visibility);
            map.setLayoutProperty('earthquakes-halo', 'visibility', visibility);
        }
    });

    document.getElementById('toggle-flights').addEventListener('change', (e) => {
        toggles.flights = e.target.checked;
        flightMarkers.forEach(m => {
            if(m.marker.getElement()) m.marker.getElement().style.display = toggles.flights ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-weather').addEventListener('change', (e) => {
        toggles.weather = e.target.checked;
        if (map.getLayer('weather-radar')) {
            map.setLayoutProperty('weather-radar', 'visibility', toggles.weather ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-ships').addEventListener('change', (e) => {
        toggles.ships = e.target.checked;
        shipMarkers.forEach(s => {
            if(s.marker.getElement()) s.marker.getElement().style.display = toggles.ships ? 'block' : 'none';
        });
    });

    document.getElementById('toggle-webcams').addEventListener('change', (e) => {
        toggles.webcams = e.target.checked;
        webcamMarkers.forEach(m => {
            if(m.getElement()) m.getElement().style.display = toggles.webcams ? 'block' : 'none';
        });
    });

    setInterval(() => {
        if(statusText.innerText.includes("UPDATED") || statusText.innerText.includes("LOADED") || statusText.innerText.includes("ESTABLISHED") || statusText.innerText.includes("SYNCHRONIZED")) {
            setStatus("SYSTEM NOMINAL // RECEIVING UPLINK");
        }
    }, 5000);
});
