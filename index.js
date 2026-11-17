const $ = (id) => document.getElementById(id);

const tempBox = $('tempBox');
const flagBG = $('flagBG');

let hourlyUrl = null;

const FLAG_COLORS = { green: '#1dd284', yellow: '#d2cc1d', red: '#d22c1d', blue: '#3b5f8f', white: '#f5f5f7', black: '#222' };


async function getLocationFromCoords(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Reverse geocoding error: ${response.status}`);
    const data = await response.json();
    
    const city = data.address?.city || data.address?.town || data.address?.village || '';
    const state = data.address?.state || '';
    
    // Return a clean string instead of the whole object
    return city && state ? `${city}, ${state}` : data.display_name;
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return "Unknown Location";
  }
}

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
        const now = await getCurrentWeather(lat,lon);
        $('location').textContent = await getLocationFromCoords(lat, lon);
        $('currentTemp').textContent = `${now.temperature}°`;
        $('conditions').textContent = now.shortForecast;
        setFlag(flagFor(now.shortForecast));
    } catch (err) {
        console.error('Failed to fetch NWS weather data:', err);
    }
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
        hourlyUrl = (await point.json()).properties.forecastHourly;
    }

    const res = await fetch(hourlyUrl, { headers });
    if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
    return (await res.json()).properties.periods[0];
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