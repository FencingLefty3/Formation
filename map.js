import {
    $, flagFor, paintFlag, getCurrentWeather, resolveLocation,
    getSaved, setSaved, getSelectedId, setSelectedId
} from './weather.js';

let saved = getSaved()

async function  weatherFor(id) {
    const loc = await resolveLocation(id)
    const now = await getCurrentWeather(loc.lat, loc.lon)
    return { ...now, name: loc.name }
}

/* ---------- list ---------- */

function renderLocations() {
    const list = $('locationList')
    list.innerHTML = ''

    const entries = [{ id: 'current', name: 'My Location' }, ...saved]

    for (const entry of entries) {
        const li = document.createElement('li')
        li.className = 'locCard'
        li.innerHTML = `
            <span class="flagLayer"></span>
            <button class="locMain" type="button">
                <span class="locText"><b class="locName"></b><small class="locCond">Loading…</small></span>
                <span class="locTemp">--°</span>
            </button>
            ${entry.id === 'current' ? '' : '<button class="locDelete" type="button" aria-label="Delete location">✕</button>'}`
        
        li.querySelector('.locName').textContent = entry.name
        li.querySelector('.locMain').onclick = () => selectLocation(entry.id)
        const del = li.querySelector('.locDelete')
        if (del) del.onclick = () => deleteLocation(entry.id, li)

        list.append(li)

        weatherFor(entry.id).then(w => {
            li.querySelector('.locTemp').textContent = `${w.temperature}°`
            li.querySelector('.locCond').textContent =
                entry.id === 'current' ? `${w.place} · ${w.shortForecast}` : w.shortForecast
            paintFlag(li.querySelector('.flagLayer'), li, flagFor(w.shortForecast, w.temperature))
        }).catch(err => {
            console.error(err)
            li.querySelector('.locCond').textContent =
                entry.id === 'current' ? 'Location unavailable' : 'No data (US only)'
        })
    }
}
function selectLocation(id) {
    setSelectedId(id)
    location.href = 'index.html'
}

function deleteLocation(id, li) {
    saved = saved.filter(l => l.id !== id)
    setSaved(saved)
    if (getSelectedId() === id) setSelectedId('current')
    li.remove()
}

function addLocation(place) {
    if (!saved.some(l => l.id === place.id)) {
        saved.push(place)
        setSaved(saved)
    }
    $('searchInput').value = ''
    renderResults([])
    renderLocations()
}

$('editBtn').onclick = () => {
    const editing = $('locations').classList.toggle('editing')
    $('editBtn').textContent = editing ? 'Done' : 'Edit'
}

async function searchPlaces(q) {
    try {
        const params = new URLSearchParams({
            name: q, count: 8, language: 'en', format: 'json', countryCode: 'US'
        })
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
        if (!res.ok) throw new Error(`Geocoding error: ${res.status}`)
        const data = await res.json()

        return (data.results ?? [])
            .filter(r => r.country_code === 'US')
            .map(r => ({
                id: `${r.latitude.toFixed(2)},${r.longitude.toFixed(2)}`,
                name: [r.name, r.admin1].filter(Boolean).join(', '),
                lat: r.latitude,
                lon: r.longitude
            }))
    } catch (err) {
        console.error('Place search failed:', err)
        return []
    }
}

function renderResults(places) {
    const ul = $('results')
    ul.innerHTML = ''
    for (const place of places) {
        const li = document.createElement('li')
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.textContent = place.name
        btn.onclick = () => addLocation(place)
        li.append(btn)
        ul.append(li)
    }
}

let searchTimer, searchSeq = 0
$('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer)
    const q = e.target.value.trim()
    if (q.length < 2) return renderResults([])

    const seq = ++searchSeq
    searchTimer = setTimeout(async () => {
        const places = await searchPlaces(q)
        if (seq === searchSeq) renderResults(places)
    }, 250)
})

renderLocations()