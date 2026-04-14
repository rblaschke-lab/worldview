# 🌍 Worldview — Global Command Center

**Real-time educational world map combining satellite imagery, geopolitical data, and live data feeds into one interactive dashboard.**

![Version](https://img.shields.io/badge/version-9.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-GitHub%20Pages-orange)

## 🚀 Live Demo

**➡️ [Launch Worldview](https://rblaschke-lab.github.io/worldview/)**

## Features

| Category | Layers |
|----------|--------|
| **🛰️ Real-Time Tracking** | AIS Shipping, ISS Tracker, Earthquakes (USGS), NASA Wildfires, Flights, Day/Night Terminator |
| **🌐 Geopolitics** | Regime Types, Alliances & Blocs, Active Conflicts, Undersea Cables, Nuclear Plants |
| **🌋 Environment & Space** | Ocean Temperature, Surface Temperature, Population Density, Volcanoes, Radiation Sites, Starlink |

### Key Capabilities

- **2-Mode System** — EXPLORE (full satellite view) / ANALYZE (data-focused overlays)
- **Bilingual Interface** — Switch between English and German (EN/DE) with one click
- **Global Scenario Presets** — One-click educational presets (Taiwan, Red Sea, Europe Energy, Nuclear Risk)
- **AI Anomaly Detection** — Spatial anomaly scanner with severity-ranked briefings
- **Mobile-First** — Full touch support with swipeable panels and 4-button bottom nav
- **In-App INFO Panel** — Data source transparency without leaving the map

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Map Engine | [MapLibre GL JS](https://maplibre.org/) V4 |
| Satellite Imagery | Esri World Imagery |
| Architecture | Vanilla JavaScript (no frameworks) |
| Hosting | GitHub Pages (static) |
| Data Sources | USGS, NASA FIRMS, NOAA, OpenSky, AIS, Celestrak |

## Getting Started

### Run Locally

```bash
# Clone the repository
git clone https://github.com/rblaschke-lab/worldview.git
cd worldview

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
4. Your site is live at `https://<username>.github.io/worldview/`

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

Built with 🛰️ by [rblaschke-lab](https://github.com/rblaschke-lab)
