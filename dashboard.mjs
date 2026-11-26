const byId = id => document.getElementById(id);

const clock = byId("clock");
const clockDate = byId("clock-date");
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const dateFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function updateClock() {
  const now = new Date();
  clock.dateTime = now.toISOString();
  clock.textContent = timeFormat.format(now);
  clockDate.textContent = dateFormat.format(now);
}

updateClock();
setInterval(updateClock, 1000);

const search = byId("tool-search");
const cards = [...document.querySelectorAll(".tool-card")];
search.addEventListener("input", () => {
  const terms = search.value.toLowerCase().trim().split(/\s+/);
  for (const card of cards) {
    const label = card.textContent.toLowerCase();
    card.hidden = !terms.every(term => label.includes(term));
  }
  byId("search-empty").hidden = cards.some(card => !card.hidden);
});

const effect = byId("weather-effect");
for (let index = 0; index < 96; index++) {
  const particle = document.createElement("span");
  particle.className = "weather-particle";
  particle.style.setProperty("--x", (index * 37 % 128) - 24 + "vw");
  particle.style.setProperty("--fall", 6 + (index * 11 % 8) + "s");
  particle.style.setProperty("--delay", -(index * 13 % 60) / 5 + "s");
  particle.style.setProperty("--size", 2 + (index % 4) + "px");
  effect.append(particle);
}
for (let index = 0; index < 20; index++) {
  const splash = document.createElement("span");
  splash.className = "weather-splash";
  splash.style.setProperty("--x", (index * 23 % 100) + "vw");
  splash.style.setProperty("--delay", -(index * 17 % 100) / 50 + "s");
  splash.style.setProperty("--fall", 1.1 + (index % 5) / 5 + "s");
  effect.append(splash);
}

const preview = byId("weather-preview");
const sound = byId("weather-sound");
let currentTheme = "";
let audio;
let rumble;

function applyWeatherTheme() {
  document.body.dataset.weather = preview.value || currentTheme;
}

preview.addEventListener("change", applyWeatherTheme);

sound.addEventListener("click", async () => {
  if (sound.getAttribute("aria-pressed") === "true") {
    sound.setAttribute("aria-pressed", "false");
    sound.textContent = "Thunder sound off";
    rumble?.stop();
    return;
  }

  sound.disabled = true;
  try {
    audio ??= new AudioContext();
    await audio.resume();
    sound.setAttribute("aria-pressed", "true");
    sound.textContent = "Thunder sound on";
  } catch {
    sound.textContent = "Thunder sound unavailable";
  } finally {
    sound.disabled = false;
  }
});

byId("weather-bolt").addEventListener("animationiteration", event => {
  if (event.animationName !== "weather-lightning" || document.hidden ||
      sound.getAttribute("aria-pressed") !== "true" || audio?.state !== "running") return;

  const duration = 2.8;
  const now = audio.currentTime;
  const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;

  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const volume = audio.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 140;
  volume.gain.setValueAtTime(0.001, now);
  volume.gain.exponentialRampToValueAtTime(0.22, now + 0.38);
  volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
  source.connect(filter).connect(volume).connect(audio.destination);
  rumble = source;
  source.onended = () => { if (rumble === source) rumble = undefined; };
  source.start(now + 0.35);
});

const weatherStatus = byId("weather-status");
const find = byId("weather-find");
const locate = byId("weather-locate");
const town = byId("weather-town");

function describeWeather(code, isDay) {
  if ([75, 86].includes(code)) return ["blizzard", "Heavy snow"];
  if ([71, 73, 77, 85].includes(code)) return ["snow", "Snow"];
  if ([95, 96, 99].includes(code)) return ["storm", "Thunderstorms"];
  if ([56, 57, 66, 67].includes(code)) return ["rain", "Freezing rain or drizzle"];
  if ([51, 53, 55].includes(code)) return ["rain", "Drizzle"];
  if ([65, 82].includes(code)) return ["heavy-rain", "Heavy rain"];
  if ([61, 63, 80, 81].includes(code)) return ["rain", "Rain"];
  if ([45, 48].includes(code)) return ["cloud", "Fog"];
  if (code === 3) return ["cloud", "Overcast"];
  if (code === 2) return ["cloud", "Partly cloudy"];
  if (code === 0 || code === 1) return [isDay ? "clear" : "night", code === 0 ? "Clear" : "Mainly clear"];
  return ["cloud", "Conditions unavailable"];
}

async function requestJson(endpoint, params) {
  const response = await fetch(endpoint + "?" + new URLSearchParams(params), { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error("Weather service is unavailable. Try again shortly.");
  return response.json();
}

async function findTown(name) {
  const data = await requestJson("https://geocoding-api.open-meteo.com/v1/search", { name, count: 1, language: "en" });
  const [place] = data.results ?? [];
  if (!place) throw new Error("Town not found. Try a nearby town or city.");
  return {
    latitude: place.latitude,
    longitude: place.longitude,
    label: [...new Set([place.name, place.admin1, place.country].filter(Boolean))].join(", "),
  };
}

function locateDevice() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is unavailable. Enter a town or city instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({
      latitude: coords.latitude.toFixed(2),
      longitude: coords.longitude.toFixed(2),
      label: "Near you",
    }), () => reject(new Error("Could not get your location. Enter a town or city instead.")), { timeout: 10000 });
  });
}

let lastPlace;
async function loadWeather(getPlace) {
  if (find.disabled) return;
  find.disabled = locate.disabled = true;
  weatherStatus.textContent = "Loading local weather…";
  try {
    const { latitude, longitude, label } = await getPlace();
    const data = await requestJson("https://api.open-meteo.com/v1/forecast", {
      latitude, longitude, current: "temperature_2m,weather_code,is_day",
    });
    const current = data.current;
    if (!Number.isFinite(current?.temperature_2m)) throw new Error("Current conditions are unavailable.");
    const [theme, description] = describeWeather(current.weather_code, current.is_day);
    currentTheme = theme;
    applyWeatherTheme();
    weatherStatus.textContent = label + " · " + Math.round(current.temperature_2m) + "°C · " + description;
    lastPlace = { latitude, longitude, label };
  } catch (error) {
    currentTheme = "";
    applyWeatherTheme();
    weatherStatus.textContent = error.name === "TypeError" || error.name === "TimeoutError"
      ? "Could not reach the weather service. Try again shortly."
      : error.message;
  } finally {
    find.disabled = locate.disabled = false;
  }
}

byId("weather-form").addEventListener("submit", event => {
  event.preventDefault();
  const name = town.value.trim();
  if (name.length < 2) {
    weatherStatus.textContent = "Enter a town or city.";
    return;
  }
  loadWeather(() => findTown(name));
});
locate.addEventListener("click", () => loadWeather(locateDevice));
setInterval(() => {
  if (lastPlace && !document.hidden) loadWeather(() => lastPlace);
}, 10 * 60 * 1000);
