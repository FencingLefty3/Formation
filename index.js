const $ = (id) => document.getElementById(id);

const tempBox = $('tempBox');
const flagBG = $('flagBG');

let hourlyUrl = null;
let locationName = '';

const FLAG_COLORS = { green: '#1dd284', yellow: '#d2cc1d', red: '#d22c1d', blue: '#3b5f8f', white: '#f5f5f7', black: '#222' };

const cache = {
    get(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;
            const { t, v } = JSON.parse(raw)
            return { value: v, age: Date.now() - t }
        } catch { return null }
    },
    set(key, value) {
        try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }))}
        catch { }
    }
}

const WEATHER_TTL = 10 * 60 * 1000;                
const LONG_TTL    = 30 * 24 * 60 * 60 * 1000;

const keyFor = (prefix, lat, lon) => `${prefix}:${lat.toFixed(2)},${lon.toFixed(2)}`;

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject("Geolocation not supported");
    }
    navigator.geolocation.getCurrentPosition(resolve, reject);
  });
}

function doubleYellow() {
    clearFlag();
    tempBox.classList.add('doubleYellow');
    flagBG.innerHTML = '<i></i><i></i>';

    const [left, right] = flagBG.children;
    const timing = { duration: 1000, iterations: Infinity };

    // step-end = hard on/off, like a real LED board
    left.animate([
        { opacity: 1,    easing: 'step-end' },
        { opacity: 0, offset: 0.5, easing: 'step-end' },
        { opacity: 1 }
    ], timing);

    right.animate([
        { opacity: 0, easing: 'step-end' },
        { opacity: 1,    offset: 0.5, easing: 'step-end' },
        { opacity: 0 }
    ], timing);
}

function setFlag(name) {
    if (name === 'doubleYellow') return doubleYellow();
    clearFlag();
    flagBG.style.background = FLAG_COLORS[name];
    tempBox.classList.toggle('darkText', name === 'yellow');
}

async function update() {
    const position = await getLocation();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    try {
        const periods = await getCurrentWeather(lat,lon);
        const now = periods[0];
        $('location').textContent = locationName;
        $('currentTemp').textContent = `${now.temperature}°`;
        $('conditions').textContent = now.shortForecast;
        setFlag(flagFor(now.shortForecast));
        renderHourlyForecast(periods.slice(0, 6));
    } catch (err) {
        console.error('Failed to fetch NWS weather data:', err);
    }
}

function iconFor(period) {
    const condition = period.shortForecast.toLowerCase();
    const isDaytime = period.isDaytime;
    let filename;

    if (/tornado|hurricane|blizzard|severe|warning/.test(condition)) {
        filename = 'cloud-exclamation-point.png';
    } else if (/thunder|lightning/.test(condition)) {
        filename = 'cloud-lightning.png';
    } else if (/snow|flurries/.test(condition)) {
        filename = 'snowflake.png';
    } else if (/rain|shower|drizzle|sleet|freezing|ice|wind/.test(condition)) {
        filename = 'cloud-rain-wind.png';
    } else if (/fog|mist|haze/.test(condition)) {
        filename = 'cloud-fog.png';
    } else if (/partly|mostly sunny/.test(condition)) {
        filename = isDaytime ? 'cloud-sun.png' : 'cloud-moon.png';
    } else if (/cloudy|overcast/.test(condition)) {
        filename = 'cloud.png';
    } else if (/sunny|clear|fair/.test(condition)) {
        filename = isDaytime ? 'sun.png' : 'moon-star.png';
    } else {
        filename = isDaytime ? 'cloud-sun.png' : 'cloud-moon.png';
    }

    return `icons/${filename}`;
}

function renderHourlyForecast(periods) {
    const hourlyBox = $('hourlyBox');
    hourlyBox.replaceChildren(...periods.map(period => {
        const item = document.createElement('div');
        item.className = 'hourlyPeriod';

        const icon = document.createElement('img');
        icon.className = 'hourlyIcon';
        icon.src = iconFor(period);
        icon.alt = period.shortForecast;

        const temperature = document.createElement('strong');
        temperature.textContent = `${period.temperature}°`;

        const hour = document.createElement('time');
        hour.dateTime = period.startTime;
        hour.textContent = new Date(period.startTime).toLocaleTimeString([], { hour: 'numeric' });


        item.append(hour, icon, temperature);
        return item;
    }));
}

function clearFlag() {
    flagBG.getAnimations({ subtree: true }).forEach(a => a.cancel());
    flagBG.innerHTML = '';
    flagBG.style.background = '';   // new: reset solid flag colors
    tempBox.classList.remove('doubleYellow', 'darkText');
}

async function getCurrentWeather(lat, lon) {
    const headers = { Accept: 'application/geo+json' };

    if (!hourlyUrl) {
        const point = await fetch(`https://api.weather.gov/points/${lat},${lon}`, { headers });
        if (!point.ok) throw new Error(`Points API error: ${point.status}`);
        const properties = (await point.json()).properties;
        hourlyUrl = properties.forecastHourly;
        const relativeLocation = properties.relativeLocation?.properties;
        locationName = relativeLocation
            ? [relativeLocation.city, relativeLocation.state].filter(Boolean).join(', ')
            : 'Current Location';
    }

    const res = await fetch(hourlyUrl, { headers });
    if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
    return (await res.json()).properties.periods;
}

// Map NWS text (e.g. "Slight Chance Rain Showers") to a flag
function flagFor(shortForecast) {
    const t = shortForecast.toLowerCase();
    if (/thunder|tornado|hurricane|blizzard|ice storm/.test(t)) return 'red';
    if (/heavy|freezing|sleet|snow|storm/.test(t)) return 'doubleYellow';
    if (/rain|showers|drizzle|fog|haze|wind|mist/.test(t)) return 'yellow';
    return 'green';
}



update();
setInterval(update, 10 * 60 * 1000); // refresh every 10 min