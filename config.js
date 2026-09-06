// Global GEOPULSE Configuration
window.GeopulseConfig = {
    VERSION: "2.6",
    // NASA FIRMS map key — free, per-user, rate-limited, read-only.
    // Public by design (client-side); rotate at firms.modaps.eosdis.nasa.gov if needed.
    FIRMS_MAP_KEY: "53809ad8a8e6c66c28d2b1e2a85b3d80",
    METRICS: {
        FEEDS: 20,
        COUNTRIES: 102,
        LAYERS: 23
    },
    LAYER_METADATA: {
        "weather": { id: "weather", name: "Weather Radar", status: "STATIC", source: "RainViewer API", reliabilityScore: 99 },

        "iss": { id: "iss", name: "ISS Track", status: "STATIC", source: "WhereTheISS API", reliabilityScore: 99 },
        "fires": { id: "fires", name: "NASA Wildfires", status: "LIVE", source: "NASA FIRMS (VIIRS)", reliabilityScore: 95 },
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
        "webcams": { id: "webcams", name: "Live Webcams", status: "LIVE", source: "foto-webcam.eu", reliabilityScore: 92 },
        "starlink": { id: "starlink", name: "Starlink Net", status: "STATIC", source: "Orbital Sim", reliabilityScore: 100 },
        "satellites": { id: "satellites", name: "Sat & Debris", status: "STATIC", source: "SpaceTrack", reliabilityScore: 92 },
        "volcanoes": { id: "volcanoes", name: "Volcanoes", status: "STATIC", source: "Smithsonian", reliabilityScore: 95 },
        "radiation": { id: "radiation", name: "Radiation Sites", status: "STATIC", source: "Safecast", reliabilityScore: 85 },
        "aurora": { id: "aurora", name: "Aurora Forecast", status: "LIVE", source: "NOAA OVATION", reliabilityScore: 95 },
        "fireballs": { id: "fireballs", name: "Fireballs", status: "LIVE", source: "NASA CNEOS", reliabilityScore: 98 },
        "wind": { id: "wind", name: "Global Winds", status: "STATIC", source: "Open-Meteo", reliabilityScore: 92 },
        "religion": { id: "religion", name: "Religious Affiliation", status: "STATIC", source: "Pew Research Center 2020", reliabilityScore: 90 }
    },
    FEEDBACK: {
        GOOGLE_FORM_URL: "https://docs.google.com/forms/d/e/1FAIpQLSd6IWB0Y9rRQvGkzIPT4I7M3qwNapSzd-LiujURIDGST_5qNg/viewform",
        GITHUB_ISSUES_URL: "https://github.com/rblaschke-lab/geopulse/issues/new",
        FIELD_RATING: "entry.1714435113",   // How do you rate GEOPULSE? (1-5)
        FIELD_FAVOURITE: "entry.552326087",  // What do you enjoy most
        FIELD_COMMENT: "entry.739073844",    // Any comments or suggestions?
        FIELD_WISH: "entry.2034568167"       // What feature would you like to see next?
    }
};
