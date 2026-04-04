# Data Reliability Engineer: API Stabilization Plan

The goal is to eliminate "broken maps" and introduce a Graceful Degradation model for all external API feeds (USGS, OpenSky, NASA, ISS, etc.). When a feed fails, the map will load the last known good state from a structured fallback cache and visually mark the layer as "DEGRADED".

## User Review Required

> [!IMPORTANT]
> - **Cache Storage Limits**: I plan to use `localStorage` for the Cache Layer since it's universally supported and easy to maintain without a backend. However, `localStorage` is limited to ~5MB. If layers like Earthquakes or Flights grow too large, we might need to compress the payload or use `IndexedDB`. Is `localStorage` fine to start with?
> - **Global Fetch Replacement**: We will replace all native `fetch()` calls in `main.js` with the new `reliableFetch()` wrapper. 

## Proposed Changes

### Core Architecture

We will implement a resilient Data Fetching Architecture:
1. **Timeout-Handling**: Abort external requests if they take longer than `<X>` milliseconds (e.g. 5000ms for fast feeds, 15000ms for large geojson). This prevents UI blocks.
2. **Retry-Mechanismus**: If a request drops or timeouts, automatically attempt 1-2 retries with exponential backoff before throwing an error.
3. **Cache Layer**: On any successful fetch, persist the data timestamped into `localStorage`. 

### Logic Execution Flow

- **Path A (Live)**: User requests data -> Fetch succeeds -> Update cache -> Show "LIVE".
- **Path B (Fallback)**: User requests data -> Fetch fails / times out -> Check cache -> Cache exists -> Load cache -> Show "DEGRADED (Last updated X min ago)".
- **Path C (Total Failure)**: Fetch fails -> No cache -> Show "ERROR (No Data)".

---

### main.js & fetchWrapper

#### [NEW] `c:/Users/GIGABYTE/.gemini/antigravity/scratch/worldview/fetchWrapper.js`
A dedicated reliability wrapper exposing `reliableFetch(url, cacheKey, options)`. 
```javascript
// Example Code Snippet:
async function reliableFetch(url, cacheKey, options = {}) {
    const { timeout = 8000, retries = 1 } = options;

    const fetchWithTimeout = async (url, opts) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), opts.timeout);
        try {
            const res = await fetch(url, { ...opts, signal: controller.signal });
            clearTimeout(id);
            return res;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    let attempt = 0;
    while (attempt <= retries) {
        try {
            const response = await fetchWithTimeout(url, { timeout });
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const data = await response.json();
            // Cache successful data
            localStorage.setItem(`wv_cache_${cacheKey}`, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
            return { data, status: 'LIVE' };
        } catch (error) {
            attempt++;
            if (attempt > retries) {
                console.warn(`[RELIABILITY] ${cacheKey} fetch failed. Checking cache...`);
                // Fallback to cache
                const cached = localStorage.getItem(`wv_cache_${cacheKey}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const minutesAgo = Math.round((Date.now() - parsed.timestamp) / 60000);
                    return { data: parsed.data, status: 'DEGRADED', minutesAgo };
                }
                throw error; // No cache, hard fail
            }
            // Wait before retry
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}
```

#### [MODIFY] `c:/Users/GIGABYTE/.gemini/antigravity/scratch/worldview/index.html`
- Include `<script src="./fetchWrapper.js"></script>` before `main.js`.

#### [MODIFY] `c:/Users/GIGABYTE/.gemini/antigravity/scratch/worldview/style.css`
Add a visually distinct style for `stale data` or `degraded states`:
```css
.status-degraded {
    background: rgba(255, 176, 0, 0.15) !important;
    color: #ffb000 !important;
    border: 1px solid #ffb000 !important;
    animation: pulse-amber 2s infinite;
}
@keyframes pulse-amber {
    0% { box-shadow: 0 0 0 0 rgba(255,176,0,0.4); }
    70% { box-shadow: 0 0 0 4px rgba(255,176,0,0); }
    100% { box-shadow: 0 0 0 0 rgba(255,176,0,0); }
}
```

#### [MODIFY] `c:/Users/GIGABYTE/.gemini/antigravity/scratch/worldview/main.js`
- Change `updateLayerStatus(id, status, errorMsg)` to accept `staleMsg` and show `DEGRADED`.
- Wrap API calls like `fetchISS`, `fetchEarthquakes`, `fetchWeather` replacing plain `fetch()` with `reliableFetch()`.
- Example for Earthquakes:
```javascript
const fetchEarthquakes = async () => {
    setStatus("FETCHING SEISMIC DATA...");
    try {
        const { data, status, minutesAgo } = await reliableFetch(
            'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
            'earthquakes',
            { timeout: 10000, retries: 1 }
        );
        // ... process geometry ...
        if (status === 'DEGRADED') {
            updateLayerStatus('earthquakes', 'DEGRADED', `Last updated ${minutesAgo}m ago`);
        } else {
            updateLayerStatus('earthquakes', 'LIVE');
        }
    } catch(err) {
        updateLayerStatus('earthquakes', 'ERROR', err.message);
    }
};
```

## Open Questions
- Is Exponential Backoff specifically requested, or is a plain static 1-2 second retry sufficient before flipping to degraded cache?

## Verification Plan
### Manual Verification
1. Open the UI, wait for initial layer loads (so they cache).
2. Set browser network to "Offline" or use DevTools Network Throttling.
3. Observe layers reloading with `DEGRADED (Last updated Xm ago)`.
4. Ensure the UI doesn't crash on timeouts.
