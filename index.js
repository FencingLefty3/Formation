const $ = (id) => document.getElementById(id);

const tempBox = $('tempBox');
const flagBG = $('flagBG');
const dialog = $('alertDialog')

let hourlyUrl = null;
let dailyUrl = null;
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

function groupDailyPeriods(periods) {
    const days = [];

    for (const period of periods) {
        if (period.isDaytime) {
            days.push({
                name: period.name,
                date: period.startTime,
                high: period.temperature,
                low: null,
                shortForecast: period.shortForecast,
                isDaytime: true
            });
        } else if (days.length) {
            days[days.length - 1].low = period.temperature;
        } else {
            
            days.push({
                name: period.name,
                date: period.startTime,
                high: null,
                low: period.temperature,
                shortForecast: period.shortForecast,
                isDaytime: false
            });
        }
    }

    return days.slice(0, 7);
}

async function update() {
    try {
        const position = await getLocation();
        const lat = '55.3773372';
        const lon = '-131.7375108';
        const periods = await getCurrentWeather(lat,lon);
        const now = periods[0];
        const dailyPeriods = await getDailyForecast();
        $('location').textContent = locationName;
        $('currentTemp').textContent = `${now.temperature}°`;
        $('conditions').textContent = now.shortForecast;
        setFlag(flagFor(now.shortForecast));
        renderHourlyForecast(periods.slice(0, 6));
        render7DayForecast(groupDailyPeriods(dailyPeriods));
        alertFor(await getActiveAlerts(lat, lon));
    } catch (err) {
        console.error('Failed to fetch NWS weather data:', err);
    }
}
function openAlert(alerts) {
    const title = document.createElement('h2')
    title.textContent = 'Weather Alerts';

    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'X'
    close.className = 'alertDialogClose'
    close.addEventListener('click', () => dialog.close())

    const header = document.createElement('div');
    header.className = 'alertDialogHeader';
    header.append(title, close);

    const cards = alerts.map(alert => {
        const card = document.createElement('article')
        card.className = 'alertDetails'
        const heading = document.createElement('strong')
        heading.textContent = alert.event || 'Weather Alert'
        card.append(heading);

        addAlertDetail(card, 'Headline', alert.headline)
        const severity = alert.severity || 'Unknown';

        const severityRow = document.createElement('p');
        const severityLabel = document.createElement('strong');
        severityLabel.textContent = `Severity: `;
        const severityContent = document.createElement('span');
        severityContent.textContent = `${severity.toLowerCase()}`

        const severityDescription = document.createElement('span');
        severityDescription.textContent = severityDetails(severity);

        severityRow.append(
            severityLabel,
            severityContent,
            document.createElement('br'),
            severityDescription
        );
        card.append(severityRow);
        addAlertDetail(card, 'Urgency', urgencyDetails(alert.urgency))
        addAlertDetail(card, 'Affected area', alert.area)
        addAlertDetail(card, 'Effective', formatAlertDate(alert.effective))
        addAlertDetail(card, 'Expires', formatAlertDate(alert.expires))
        addAlertDetail(card, 'Description', alert.description, 'alertDescription')
        addAlertDetail(card, 'Instructions', alert.instruction, 'alertDescription')
        addAlertDetail(card, 'Issued by', alert.senderName)
        return card;
    });

    dialog.replaceChildren(header, ...cards)
    dialog.showModal()
}

function severityDetails(severity) {
    const descriptions = {
        Extreme: 'Extraordinary threat to life or property',
        Severe: 'Significant threat to life or property',
        Moderate: 'Possible threat to life or property',
        Minor: 'Minimal or no known threat to life or property',
        Unknown: 'Threat level is unknown'
    };
    return descriptions[severity] || '';
}

function urgencyDetails(urgency) {
    const descriptions = {
        Immediate: 'Responsive action should be taken immediately',
        Expected: 'Responsive action should be taken soon (within the next hour)',
        Future: 'Responsive action should be taken in the near future',
        Past: 'Responsive action is no longer required',
        Unknown: 'Urgency is unknown'
    };
    return descriptions[urgency] || '';
}

function addAlertDetail(card, label, value, className = '', bool) {
    if (!value) return;

    const row = document.createElement('p');
    if (className) row.className = className
    const name = document.createElement('strong');
    name.textContent = `${label}: `;
    const br = document.createElement('br')
    if (bool === false) row.append(name, document.createTextNode(String(value)));
    else row.append(name, br, document.createTextNode(String(value)));
    card.append(row);
}
function formatAlertDate(value) {
    return value ? new Date(value).toLocaleString() : '';
}
function alertFor(alerts) {
    console.log(alerts)
    const main = $('header');

    main.querySelectorAll('#activeAlert, .activeAlert')
        .forEach(alert => alert.remove());

    if (alerts === null || alerts.length === 0) return;

    const existing = $('activeAlert');
    if (existing) existing.remove();

    if (alerts === null || alerts.length === 0) return;

    
//------------------------------------------------------------------------------------//

    const div = document.createElement('div')
    div.id = 'activeAlert';
    div.className = 'alertRow activeAlert';

    div.addEventListener('click', () => openAlert(alerts))

    const img = document.createElement('img')
    img.src = 'formationLogoWhite.png'

    const ri = document.createElement('ri')
    
    const p1 = document.createElement('p')
    const first = alerts[0].event
    const message = alerts.length > 1
        ? `${first} +${alerts.length - 1} more`
        : first;

    const words = message.trim().split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);

    p1.textContent = words.length > 1
        ? `${words.slice(0, midpoint).join(' ')}\n${words.slice(midpoint).join(' ')}`
        : message;
    p1.style.whiteSpace = 'pre-line';

    const arrow = document.createElement('span');
    arrow.className = 'alertArrow'
    arrow.setAttribute('aria-hidden', 'true');


    ri.append(p1, arrow);
    div.append(img, ri);
    main.append(div);


//------------------------------------------------------------------------------------//




}
function iconFor(period) {
    const condition = period.shortForecast.toLowerCase();
    const isDaytime = period.isDaytime;
    let filename;

    if (/tornado|hurricane|blizzard|severe|warning/.test(condition)) {
        filename = 'cloud-exclamation-point.svg';
    } else if (/thunder|lightning/.test(condition)) {
        filename = 'cloud-lightning.svg';
    } else if (/snow|flurries/.test(condition)) {
        filename = 'snowflake.svg';
    } else if (/rain|shower|drizzle|sleet|freezing|ice|wind/.test(condition)) {
        filename = 'cloud-rain-wind.svg';
    } else if (/fog|mist|haze/.test(condition)) {
        filename = 'cloud-fog.svg';
    } else if (/partly|mostly sunny/.test(condition)) {
        filename = isDaytime ? 'cloud-sun.svg' : 'cloud-moon.svg';
    } else if (/cloudy|overcast/.test(condition)) {
        filename = 'cloud.svg';
    } else if (/sunny|clear|fair/.test(condition)) {
        filename = isDaytime ? 'sun.svg' : 'moon-star.svg';
    } else {
        filename = isDaytime ? 'cloud-sun.svg' : 'cloud-moon.svg';
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

function render7DayForecast(days) {
    const forecastBox = $('forcastBox');

    forecastBox.replaceChildren(...days.map(day => {
        const item = document.createElement('div');
        item.className = 'dailyPeriod';

        const date = document.createElement('time');
        date.dateTime = day.date;
        date.textContent = day.name;

        const icon = document.createElement('img');
        icon.className = 'dailyIcon';
        icon.src = iconFor(day);
        icon.alt = day.shortForecast;

        const temperatures = document.createElement('strong');
        temperatures.className = 'dailyTemperatures';
        temperatures.textContent =
            `H ${day.high ?? '--'}° / L ${day.low ?? '--'}°`;

        const condition = document.createElement('span');
        condition.className = 'dailyCondition';
        condition.textContent = day.shortForecast;

        item.append(date, icon, condition, temperatures);
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
        dailyUrl = properties.forecast; 
        const relativeLocation = properties.relativeLocation?.properties;
        locationName = relativeLocation
            ? [relativeLocation.city, relativeLocation.state].filter(Boolean).join(', ')
            : 'Current Location';
    }
    const res = await fetch(hourlyUrl, { headers });
    if (!res.ok) throw new Error(`Forecast API error: ${res.status}`);
    return (await res.json()).properties.periods;
}

async function getActiveAlerts(lat, lon) {
    const url = new URL(`https://api.weather.gov/alerts/active`);
    url.searchParams.set('point', `${lat},${lon}`)

    const response = await fetch(url, {
        headers: { Accept: 'application/geo+json' }
    });
    if (!response.ok) throw new Error(`Alerts API error: ${response.status}`)
    
    const { features } = await response.json()
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

    }))
    
}
async function getDailyForecast() {
    const response = await fetch(dailyUrl, {
        headers: { Accept: 'application/geo+json' }
    });
    if (!response.ok) throw new Error(`Daily forecast error: ${response.status}`);

    return (await response.json()).properties.periods;
}
// Map NWS text (e.g. "Slight Chance Rain Showers") to a flag
function flagFor(shortForecast) {
    const t = shortForecast.toLowerCase();
    if (/thunder|tornado|hurricane|blizzard|ice storm/.test(t)) return 'red';
    if (/heavy|freezing|sleet|snow|storm/.test(t)) return 'doubleYellow';
    if (/rain|showers|drizzle|fog|haze|wind|mist/.test(t)) return 'yellow';
    return 'green';
}


dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});
update();
setInterval(update, 10 * 60 * 1000); // refresh every 10 min