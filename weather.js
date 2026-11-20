export const $ = (id) => document.getElementById(id);

export const FLAG_COLORS = {
    green: '#1dd284', yellow: '#d2cc1d', red: '#d22c1d',
    blue: '#3b5f8f', white: '#f5f5f7', black: '#222'
};

const cache = {
    get(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const { t, v } = JSON.parse(raw);
            return { value: v, age: Date.now() - t };
        } catch { return null; }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }
        catch { }
    }
};

const WEATHER_TTL = 10 * 60 * 1000;
const LONG_TTL = 30 * 24 * 60 * 60 * 1000;
const NWS_HEADERS = { Accept: 'application/geo+json' };
const keyFor = (prefix, lat, lon) => `${prefix}:${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;

/* ---------- geolocation ---------- */
export function getLocation() {
    return new Promise((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocation not supported'));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            maximumAge: 10 * 60 * 1000,
            timeout: 10000
        });
    });
}

/* ---------- NWS ---------- */
async function getGridInfo(lat, lon) {
    const key = keyFor('grid', lat, lon);
    const cached = cache.get(key);
    if (cached && cached.age < LONG_TTL) return cached.value;

    const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers: NWS_HEADERS });
    if (!res.ok) throw new Error(`Points API error: ${res.status}`);
    const props = (await res.json()).properties;
    const rel = props.relativeLocation?.properties;

    const info = {
        hourlyUrl: props.forecastHourly,
        dailyUrl: props.forecast,
        place: rel ? [rel.city, rel.state].filter(Boolean).join(', ') : 'Current Location'
    };
    cache.set(key, info);
    return info;
}

async function cachedForecast(prefix, urlKey, lat, lon) {
    const key = keyFor(prefix, lat, lon);
    const cached = cache.get(key);
    if (cached && cached.age < WEATHER_TTL) return cached.value;

    try {
        const info = await getGridInfo(lat, lon);
        const res = await fetch(info[urlKey], { headers: NWS_HEADERS });
        if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
        const periods = (await res.json()).properties.periods;
        cache.set(key, periods);
        return periods;
    } catch (err) {
        if (cached) {                       // offline or API hiccup: show the old data
            console.warn('Using stale cache:', err);
            return cached.value;
        }
        throw err;
    }
}

export const getHourly = (lat, lon) => cachedForecast('hourly', 'hourlyUrl', lat, lon);
export const getDaily = (lat, lon) => cachedForecast('daily', 'dailyUrl', lat, lon);
export const getPlace = async (lat, lon) => (await getGridInfo(lat, lon)).place;

// cached data can be older than an hour, so start from the period we're actually in
export function upcoming(periods) {
    const i = periods.findIndex(p => new Date(p.endTime) > Date.now());
    return periods.slice(Math.max(i, 0));
}

export async function getCurrentWeather(lat, lon) {
    const [periods, place] = await Promise.all([getHourly(lat, lon), getPlace(lat, lon)]);
    return { ...upcoming(periods)[0], place };
}

export async function getActiveAlerts(lat, lon) {
    const url = new URL('https://api.weather.gov/alerts/active');
    url.searchParams.set('point', `${lat},${lon}`);

    const response = await fetch(url, { headers: NWS_HEADERS });
    if (!response.ok) throw new Error(`Alerts API error: ${response.status}`);

    const { features } = await response.json();
    return features.map(({ properties }) => ({
        event: properties.event,
        headline: properties.headline,
        severity: properties.severity,
        urgency: properties.urgency,
        senderName: properties.senderName,
        area: properties.areaDesc,
        effective: properties.effective || properties.onset,
        expires: properties.expires || properties.ends,
        description: properties.description,
        instruction: properties.instruction
    }));
}

/* ---------- flags ---------- */
export function flagFor(shortForecast) {
    const t = shortForecast.toLowerCase();
    if (/thunder|tornado|hurricane|blizzard|ice storm/.test(t)) return 'red';
    if (/heavy|freezing|sleet|snow|storm/.test(t)) return 'doubleYellow';
    if (/rain|showers|drizzle|fog|haze|wind|mist/.test(t)) return 'yellow';
    if (/ice|/)
    return 'green';
}

// layer = the .flagLayer element, box = the element whose text color should adapt
export function paintFlag(layer, box, name) {
    layer.getAnimations({ subtree: true }).forEach(a => a.cancel());
    layer.innerHTML = '';
    layer.style.background = '';
    box.classList.toggle('darkText', name === 'yellow' || name === 'doubleYellow');

    if (name !== 'doubleYellow') {
        layer.style.background = FLAG_COLORS[name];
        return;
    }

    layer.innerHTML = '<i></i><i></i>';
    const [left, right] = layer.children;
    const timing = { duration: 1000, iterations: Infinity };

    const anims = [
        left.animate([
            { opacity: 1, easing: 'step-end' },
            { opacity: 0, offset: 0.5, easing: 'step-end' },
            { opacity: 1 }
        ], timing),
        right.animate([
            { opacity: 0, easing: 'step-end' },
            { opacity: 1, offset: 0.5, easing: 'step-end' },
            { opacity: 0 }
        ], timing)
    ];
    anims.forEach(a => { a.startTime = 0; });   // sync every double-yellow flag on the page
}

/* ---------- saved locations ---------- */
const LS_SAVED = 'formation:locations';
const LS_SELECTED = 'formation:selected';

export function getSaved() {
    try { return JSON.parse(localStorage.getItem(LS_SAVED)) ?? []; }
    catch { return []; }
}
export function setSaved(list) {
    try { localStorage.setItem(LS_SAVED, JSON.stringify(list)); } catch { }
}
export function getSelectedId() {
    try { return localStorage.getItem(LS_SELECTED) || 'current'; }
    catch { return 'current'; }
}
export function setSelectedId(id) {
    try { localStorage.setItem(LS_SELECTED, id); } catch { }
}

// id is 'current' (GPS) or a saved location's id -> { lat, lon, name }
export async function resolveLocation(id) {
    if (id !== 'current') {
        const loc = getSaved().find(l => l.id === id);
        if (loc) return { lat: loc.lat, lon: loc.lon, name: loc.name };
        // the selected place was deleted: fall through to GPS
    }
    const { coords } = await getLocation();
    const { latitude: lat, longitude: lon } = coords;
    return { lat, lon, name: await getPlace(lat, lon) };
}