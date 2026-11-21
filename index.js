import {
    $, paintFlag, flagFor, upcoming, COMPOUNDS, compoundFor,
    getHourly, getDaily, getActiveAlerts, resolveLocation, getCachedLocation, getSelectedId,
    BANDS
} from './weather.js';

const tempBox = $('tempBox');
const flagBG = $('flagBG');
const dialog = $('alertDialog');

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
                detailedForecast: period.detailedForecast,
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
                detailedForecast: period.detailedForecast,
                isDaytime: false
            });
        }
    }

    return days.slice(0, 7);
}

async function update() {
    const selectedId = getSelectedId();
    const cachedLocation = getCachedLocation(selectedId);
    let renderedFromCache = false;

    if (cachedLocation) {
        try {
            await renderWeather(cachedLocation);
            renderedFromCache = true;
        } catch (err) {
            console.warn('Could not load cached weather:', err);
        }
    }

    try {
        const location = await resolveLocation(selectedId);
        if (!cachedLocation || !sameLocation(cachedLocation, location) || !renderedFromCache) {
            await renderWeather(location);
        }
    } catch (err) {
        console.error('Failed to fetch NWS weather data:', err);
        if (!renderedFromCache) $('noLocation').showModal();
    }
}

async function renderWeather(location) {
    const [hourly, daily] = await Promise.all([
        getHourly(location.lat, location.lon),
        getDaily(location.lat, location.lon)
    ]);

    const periods = upcoming(hourly);
    const now = periods[0];
    if (!now) throw new Error('No current hourly forecast is available.');

    const days = groupDailyPeriods(daily);
    $('location').textContent = location.name;
    $('currentTemp').textContent = `${now.temperature}°`;
    $('conditions').textContent = now.shortForecast;
    paintFlag(flagBG, tempBox, flagFor(now.shortForecast));
    renderHourlyForecast(periods.slice(0, 12));
    render7DayForecast(days);
    renderDayCompound(days);
    renderEngineerBox(days)

    getActiveAlerts(location.lat, location.lon)
        .then(alertFor)
        .catch(err => {
            console.error('Failed to fetch active alerts:', err);
            alertFor(null);
        });
}

function sameLocation(first, second) {
    return Number(first.lat).toFixed(2) === Number(second.lat).toFixed(2)
        && Number(first.lon).toFixed(2) === Number(second.lon).toFixed(2);
}

function openAlert(alerts) {
    const title = document.createElement('h2')
    title.textContent = 'Weather Alerts';

    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'X'
    close.className = 'alertdialogClose'
    close.addEventListener('click', () => dialog.close())

    const header = document.createElement('div');
    header.className = 'alertdialogHeader';
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
function renderDayCompound(days) {
    const box = $('compoundBox');
    const today = days[0]

    const high = today?.high ?? today?.low ?? null
    const low = today?.low  ?? today?.high ?? null

    const avrg = (high + low) / 2
    const avrgCompound = compoundFor(avrg);
    const lowCompound = compoundFor(low);
    const highCompound = compoundFor(high);
    
    const Compound = avrgCompound || lowCompound || highCompound


    const row = document.createElement('div');
    row.className = 'compoundRow';

    const title = document.createElement('h3');
    title.className = 'compoundTitle';
    title.textContent = "Today's compounds";

    row.append(...[...BANDS].reverse().map(c => {
        
        if (Compound.id == c.id) {
            var COMPOUND = COMPOUNDS[1]
            var active = true
        } else if (Compound.id == c.id - 1) {
            var COMPOUND = COMPOUNDS[2]
            var active = true
        } else if (Compound.id == c.id + 1) {
            var COMPOUND = COMPOUNDS[0]
            var active = true
        } else {
            var active = false
        }

        const item = document.createElement('div');
        item.className = 'compound';
        item.classList.toggle('active', active);
        item.style.setProperty('--ring', COMPOUND ? COMPOUND.ring : 'rgba(255, 255, 255, 0.35)');

        const tyre = document.createElement('span');
        tyre.className = 'tyre';
        tyre.textContent = c.label;

        const name = document.createElement('small');
        name.textContent = COMPOUND ? COMPOUND.label : '';

        const marks = [];
        if (c === lowCompound) marks.push(`Low ${low}°`);
        if (c === highCompound) marks.push(`High ${high}°`);
        const tag = document.createElement('em');
        tag.textContent = marks.join('\n');

        item.append(tyre, name, tag);
        return item;
    }));
    box.hidden = false
    box.replaceChildren(title, row);
}

function renderEngineerBox(days) {
    const box = $('engineerBox');
    const today = days[0]
    const detailedForecast = today.detailedForecast

    const title = document.createElement('h3');
    title.className = 'compoundTitle';
    title.textContent = "Weather Engineer";

    const text = document.createElement('span');
    text.className = 'dailyCondition';
    text.textContent = detailedForecast;

    box.replaceChildren(title, text)
    box.hidden = false
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


dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    dialog.close();
  }
});
$('map').addEventListener('click', () => {
    location.href = 'map.html'
});
update();
setInterval(update, 10 * 60 * 1000); // refresh every 10 min