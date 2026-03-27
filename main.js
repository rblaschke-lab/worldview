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
            sources: {
                'esri-satellite': {
                    type: 'raster',
                    tiles: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    ],
                    tileSize: 256,
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
    
    // Store toggle states
    const toggles = {
        terminator: true,
        fires: true,
        weather: true,
        ships: true,
        flights: true,
        iss: true,
        webcams: true,
        earthquakes: true
    };

    map.on('load', () => {
        setStatus("SATELLITE DOWNLINK ESTABLISHED. INITIALIZING MODEL V4.");

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

        // Setup Earthquake geojson source & layers
        map.addSource('earthquakes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
            id: 'earthquakes-core',
            type: 'circle',
            source: 'earthquakes',
            paint: { 'circle-radius': ['*', ['get', 'mag'], 2.5], 'circle-color': '#ffb000', 'circle-opacity': 0.8 }
        });
        map.addLayer({
            id: 'earthquakes-halo',
            type: 'circle',
            source: 'earthquakes',
            paint: { 'circle-radius': ['*', ['get', 'mag'], 6], 'circle-color': 'transparent', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffb000', 'circle-stroke-opacity': 0.6 }
        });

        // Initialize Feeds
        fetchNASA_Fires();
        fetchWeather();
        fetchISS();
        setInterval(fetchISS, 5000);
        fetchEarthquakes();
        fetchFlights();
        setInterval(fetchFlights, 60000);
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
        
        // Calculate the solar declination
        const declination = Math.asin(Math.sin(e * Math.PI / 180) * Math.sin(l * Math.PI / 180)) * 180 / Math.PI;
        
        // GMT calculation for longitude translation (Greenwich Sidereal Time)
        const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
        const subsolarLon = (-(gmst * 15)) % 360; 
    
        let coords = [];
        // Trace terminator exactly 90 degrees out from subsolar spot
        for (let lon = -180; lon <= 180; lon += 1) {
            const dLon = (lon - subsolarLon) * Math.PI / 180;
            // Arc tangent provides the latitude boundary
            let lat = Math.atan(-Math.cos(dLon) / Math.tan(declination * Math.PI / 180)) * 180 / Math.PI;
            coords.push([lon, lat]);
        }
    
        // Complete the giant shadow polygon over the hemisphere wrapped in night
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
            const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
            
            map.addLayer({
                id: 'nasa-fires',
                type: 'raster',
                source: {
                    type: 'raster',
                    tiles: [
                        // Public GIBS Endpoint serving Thermal Anomalies / Active Fires 
                        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_Thermal_Anomalies_375m_All/default/${today}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`
                    ],
                    tileSize: 256
                },
                paint: {
                    'raster-opacity': 0.8
                }
            }, 'earthquakes-core'); // Render below earthquakes
            
            if(!toggles.fires) map.setLayoutProperty('nasa-fires', 'visibility', 'none');
            setStatus("NASA ACTIVE FIRES SYNCHRONIZED.");
        } catch(err) {
            console.warn("NASA Data Error:", err);
        }
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
                    tiles: [`https://tilecache.rainviewer.com${latestTime}/256/{z}/{x}/{y}/2/1_1.png`],
                    tileSize: 256
                },
                paint: { 'raster-opacity': 0.65 }
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
    const planeSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"/>
    </svg>`;

    const fetchFlights = async () => {
        setStatus("SCANNING AIRSPACE...");
        try {
            // Using a European window to ensure reliable data volume without overloading browser
            const response = await fetch('https://opensky-network.org/api/states/all?lamin=35.0&lomin=-15.0&lamax=65.0&lomax=35.0');
            if(!response.ok) throw new Error("API Limit");
            const data = await response.json();
            flightMarkers.forEach(m => m.remove());
            flightMarkers = [];
            if (!data.states) return;
            const planes = data.states.slice(0, 150);
            planes.forEach(plane => {
                const [_, callsign, __, ___, ____, lon, lat, _____, ______, velocity, true_track, _______, ________, altitude] = plane;
                if (lat && lon) {
                    const el = document.createElement('div');
                    el.className = 'marker-flight';
                    el.innerHTML = planeSvg;
                    const marker = new maplibregl.Marker({ element: el, rotation: true_track, rotationAlignment: 'map', pitchAlignment: 'map' })
                        .setLngLat([lon, lat])
                        .setPopup(new maplibregl.Popup({ offset: 15 }).setHTML(`
                            <h3>FLIGHT: ${callsign ? callsign.trim() : 'UNK'}</h3>
                            <p>ALT: ${altitude ? Math.round(altitude) + ' M' : 'N/A'}</p>
                            <p>SPD: ${velocity ? Math.round(velocity * 3.6) + ' KM/H' : 'N/A'}</p>
                        `));
                    flightMarkers.push(marker);
                    if (toggles.flights) marker.addTo(map);
                }
            });
            setStatus("AIRSPACE DATA LOADED.");
        } catch (error) { setStatus("FLIGHT DATA LIMITED/ERROR."); }
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
                s.marker.setLngLat([s.lon, s.lat]);
            });
            requestAnimationFrame(animateShips);
        }
        requestAnimationFrame(animateShips);
    };

    // ----------------------------------------------------
    // API: Live Webcams
    // ----------------------------------------------------
    const webcamData = [
        { name: 'Venice Grand Canal', code: 'ph1vpnYm4To', lat: 45.4383, lon: 12.3364 },
        { name: 'Eiffel Tower, Paris', code: 'hZf1O-lPjQk', lat: 48.8584, lon: 2.2945 },
        { name: 'Shibuya Crossing, Tokyo', code: 'HpdO5Kq3o7Y', lat: 35.6595, lon: 139.7005 },
        { name: 'Times Square, NYC', code: '1-iS7LmhJZg', lat: 40.7580, lon: -73.9855 },
        { name: 'Amsterdam / Dam Square', code: 'sL2C5YnI170', lat: 52.3729, lon: 4.8936 }
    ];

    const initWebcams = () => {
        webcamData.forEach(cam => {
            const el = document.createElement('div');
            el.className = 'marker-webcam';
            el.innerHTML = '<i class="fa-solid fa-camera-security"></i>';
            
            const popup = new maplibregl.Popup({ offset: 15, closeOnClick: true, maxWidth: '320px' });
            
            popup.on('open', () => {
                popup.setHTML(`
                    <h3><i class="fa-solid fa-camera"></i> ${cam.name}</h3>
                    <iframe width="300" height="170" src="https://www.youtube.com/embed/${cam.code}?autoplay=1&mute=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                `);
            });
            popup.on('close', () => {
                popup.setHTML(`<h3><i class="fa-solid fa-camera"></i> ${cam.name}</h3><p>Loading downlink stream...</p>`);
            });
            
            popup.setHTML(`<h3><i class="fa-solid fa-camera"></i> ${cam.name}</h3><p>Loading downlink stream...</p>`);

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
    
    // NEW / V4: Environment Layer event listeners
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

    // Original Toggles
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
        flightMarkers.forEach(m => toggles.flights ? m.addTo(map) : m.remove());
    });

    document.getElementById('toggle-weather').addEventListener('change', (e) => {
        toggles.weather = e.target.checked;
        if (map.getLayer('weather-radar')) {
            map.setLayoutProperty('weather-radar', 'visibility', toggles.weather ? 'visible' : 'none');
        }
    });

    document.getElementById('toggle-ships').addEventListener('change', (e) => {
        toggles.ships = e.target.checked;
        shipMarkers.forEach(s => toggles.ships ? s.marker.addTo(map) : s.marker.remove());
    });

    document.getElementById('toggle-webcams').addEventListener('change', (e) => {
        toggles.webcams = e.target.checked;
        webcamMarkers.forEach(s => toggles.webcams ? s.addTo(map) : s.remove());
    });

    setInterval(() => {
        if(statusText.innerText.includes("UPDATED") || statusText.innerText.includes("LOADED") || statusText.innerText.includes("ESTABLISHED") || statusText.innerText.includes("SYNCHRONIZED")) {
            setStatus("SYSTEM NOMINAL // RECEIVING UPLINK");
        }
    }, 5000);
});
