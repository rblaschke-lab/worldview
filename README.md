# 🌍 GEOPULSE — Live World Intelligence Map

**Free, real-time educational world map combining satellite imagery, geopolitical data, and live intelligence feeds into one interactive dashboard. By RB Design 2026.**

![Version](https://img.shields.io/badge/version-1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-GitHub%20Pages-orange)

## 🚀 Live Demo

**➡️ [Launch GEOPULSE](https://rblaschke-lab.github.io/geopulse/)**

## Features

| Category | Layers |
|----------|--------|
| **🛰️ Real-Time Tracking** | AIS Shipping, ISS Tracker, Earthquakes (USGS), NASA Wildfires, Flights, Day/Night Terminator |
| **🌐 Geopolitics** | Regime Types, Alliances & Blocs, Active Conflicts, Country Borders & Labels, Undersea Cables, Nuclear Plants |
| **🌋 Environment & Space** | Ocean Temperature, Surface Temperature, Population Density, Volcanoes, Radiation Sites, Starlink |

### Key Capabilities

- **Guided Tours** — 14 cinematic educational tours across 4 categories: Geopolitics, History (WW1, WW2), Science & Nature, Sports & Culture
- **2-Mode System** — EXPLORE (full satellite view) / ANALYZE (data-focused overlays)
- **Bilingual Interface** — Switch between English and German (EN/DE) with one click
- **Global Scenario Presets** — One-click educational presets (Taiwan, Red Sea, Europe Energy, Nuclear Risk)
- **AI Anomaly Detection** — Spatial anomaly scanner with severity-ranked briefings
- **Wikipedia Integration** — Click markers for detailed context with direct Wikipedia links
- **Mobile-First** — Full touch support with swipeable panels and 4-button bottom nav
- **Welcome Overlay** — First-visit onboarding with tour launcher for students
- **Tour Images** — Wikipedia thumbnails displayed at key historical/geographic stops
- **Country Borders** — Natural Earth 110m boundaries + 121 country labels (zoom-dependent)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Map Engine | [MapLibre GL JS](https://maplibre.org/) V4 |
| Satellite Imagery | Esri World Imagery |
| Architecture | Vanilla JavaScript (no frameworks, no dependencies) |
| Hosting | GitHub Pages (static) |
| Data Sources | USGS, NASA FIRMS, NOAA, OpenSky, AIS, Celestrak, Smithsonian GVP |

## Getting Started

### Run Locally

```bash
# Clone the repository
git clone https://github.com/rblaschke-lab/geopulse.git
cd geopulse

# Start a local server (any of these work)
python -m http.server 8080
# or
npx -y http-server . -p 8080

# Open in browser
open http://localhost:8080
```

### Optional: AIS Ship Tracking

To enable real-time ship tracking, get a free API key from [aisstream.io](https://aisstream.io) and add it to `config.js`:

```javascript
API_KEYS: {
    AISSTREAM: "your-key-here"
}
```

> ⚠️ **Do not commit your API key.** The key field is empty by default.

## Deployment

This project is designed for **GitHub Pages** — no build step required.

1. Push to `master` branch
2. Go to **Settings → Pages → Source → Deploy from branch**
3. Select `master` / `/ (root)` → Save
4. Your site is live at `https://<username>.github.io/geopulse/`

## Security

- **Content Security Policy (CSP)** blocks unauthorized script execution
- **No backend, no auth, no cookies** — pure static client-side app
- **All external data is HTML-escaped** before DOM insertion
- **No user data collected** — GDPR-compliant by design
- See [SECURITY.md](SECURITY.md) for responsible disclosure

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-layer`)
3. Commit your changes (`git commit -m 'Add amazing layer'`)
4. Push to the branch (`git push origin feature/amazing-layer`)
5. Open a Pull Request

## License

This project is open source under the [MIT License](LICENSE).

---

**GEOPULSE V1** — Built with 🛰️ by RB Design 2026
