// Global Worldview Configuration
window.WorldviewConfig = {
    VERSION: "9.0",
    API_KEYS: {
        AISSTREAM: "44b523190ef5f82f602075fd071ffe5f25ce966e" // USER_INSERT_API_KEY_HERE
    },
    METRICS: {
        FEEDS: 18,
        COUNTRIES: 102,
        LAYERS: 18
    },
    LAYER_METADATA: {
        "weather": { id: "weather", name: "Weather Radar", status: "STATIC", source: "RainViewer API", reliabilityScore: 99 },
        "ships": { id: "ships", name: "AIS Shipping", status: "STATIC", source: "Global AIS", reliabilityScore: 95 },
        "flights": { id: "flights", name: "Lufthansa", status: "STATIC", source: "OpenSky Network", reliabilityScore: 85 },
        "iss": { id: "iss", name: "ISS Track", status: "STATIC", source: "WhereTheISS API", reliabilityScore: 99 },
        "fires": { id: "fires", name: "NASA Wildfires", status: "STATIC", source: "NASA FIRMS", reliabilityScore: 100 },
        "earthquakes": { id: "earthquakes", name: "Seismic Activity", status: "STATIC", source: "USGS Feed", reliabilityScore: 99 },
        "internet": { id: "internet", name: "Internet Outages", status: "STATIC", source: "Global Net Monitor", reliabilityScore: 90 },
        "terminator": { id: "terminator", name: "Solar Terminator", status: "STATIC", source: "Astro Math", reliabilityScore: 100 },
        "regimes": { id: "regimes", name: "Regime Map", status: "STATIC", source: "Static Dataset", reliabilityScore: 100 },
        "blocs": { id: "blocs", name: "Geopolitical Blocs", status: "STATIC", source: "Static Dataset", reliabilityScore: 100 },
        "conflicts": { id: "conflicts", name: "Active War Zones", status: "STATIC", source: "Conflict DB", reliabilityScore: 85 },
        "cables": { id: "cables", name: "Undersea Cables", status: "STATIC", source: "Submarine Cable Map", reliabilityScore: 90 },
        "datacenters": { id: "datacenters", name: "Data Centers", status: "STATIC", source: "DC Map", reliabilityScore: 95 },
        "nuclear": { id: "nuclear", name: "Nuclear Plants", status: "STATIC", source: "Global Energy DB", reliabilityScore: 98 },
        "power": { id: "power", name: "Power Outages", status: "STATIC", source: "Grid Monitor", reliabilityScore: 80 },
        "nukes": { id: "nukes", name: "Nuclear Arsenal", status: "STATIC", source: "SIPRI DB", reliabilityScore: 90 },
        "sst": { id: "sst", name: "Ocean Temp", status: "STATIC", source: "NOAA", reliabilityScore: 98 },
        "population": { id: "population", name: "Population", status: "STATIC", source: "CIESIN", reliabilityScore: 95 },
        "temperature": { id: "temperature", name: "Surface Temp", status: "STATIC", source: "Global Temp", reliabilityScore: 98 },
        "webcams": { id: "webcams", name: "Webcam Streams", status: "STATIC", source: "EarthCam Relay", reliabilityScore: 70 },
        "starlink": { id: "starlink", name: "Starlink Net", status: "STATIC", source: "Orbital Sim", reliabilityScore: 100 },
        "satellites": { id: "satellites", name: "Sat & Debris", status: "STATIC", source: "SpaceTrack", reliabilityScore: 92 },
        "volcanoes": { id: "volcanoes", name: "Volcanoes", status: "STATIC", source: "Smithsonian", reliabilityScore: 95 },
        "radiation": { id: "radiation", name: "Radiation Sites", status: "STATIC", source: "Safecast", reliabilityScore: 85 }
    }
};
