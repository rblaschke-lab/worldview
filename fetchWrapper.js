// fetchWrapper.js - Data Reliability Engine V8.7
// Implements timeout handling, automatic retries with exponential backoff,
// and localStorage-based fallback caching for graceful degradation.

async function reliableFetch(url, cacheKey, options = {}) {
    const timeout = options.timeout || 8000;
    const retries = options.retries || 1;

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
            
            // Cache successful data (only strings can be stored in localStorage)
            try {
                localStorage.setItem(`wv_cache_${cacheKey}`, JSON.stringify({
                    timestamp: Date.now(),
                    data: data
                }));
            } catch (storageErr) {
                console.warn(`[RELIABILITY] Failed to cache ${cacheKey}: ${storageErr.message}`);
                // Proceed anyway, we have live data
            }
            
            return { data, status: 'LIVE', minutesAgo: 0 };
        } catch (error) {
            attempt++;
            if (attempt > retries) {
                console.warn(`[RELIABILITY] ${cacheKey} fetch failed (timeout/offline). Checking cache...`);
                // Fallback to cache
                const cached = localStorage.getItem(`wv_cache_${cacheKey}`);
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        const minutesAgo = Math.round((Date.now() - parsed.timestamp) / 60000);
                        return { data: parsed.data, status: 'DEGRADED', minutesAgo };
                    } catch (parseErr) {
                        throw new Error(`Fallback cache for ${cacheKey} corrupted.`);
                    }
                }
                throw error; // Hard fail - no cache and no live data
            }
            // Wait before retry (exponential backoff)
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }
}

// Global exposure
window.reliableFetch = reliableFetch;
