








const $ = (id) => document.getElementById(id);

const tempBox = $('tempBox');
const flagBG = $('flagBG');

let hourlyUrl = null;

const FLAG_COLORS = { green: '#1dd284', yellow: '#d2cc1d', red: '#d22c1d', blue: '#3b5f8f', white: '#f5f5f7', black: '#222' };

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
    try {
        const now = await getCurrentWeather(40.5587436,-120.7709412);

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