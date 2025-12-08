// Cookie helper functions with localStorage fallback
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";

  // Fallback to localStorage (works with file:// protocol)
  try {
    localStorage.setItem(name, value);
    console.log(`Saved ${name} = ${value}`);
  } catch (e) {
    console.error("Error saving to localStorage:", e);
  }
}

function getCookie(name) {
  // Try cookie first
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      const value = c.substring(nameEQ.length, c.length);
      console.log(`Loaded ${name} = ${value} from cookie`);
      return value;
    }
  }

  // Fallback to localStorage
  try {
    const value = localStorage.getItem(name);
    if (value !== null) {
      console.log(`Loaded ${name} = ${value} from localStorage`);
    }
    return value;
  } catch (e) {
    console.error("Error reading from localStorage:", e);
    return null;
  }
}

// Constants
let DEFAULT_LOCATION = { lat: 30.27, lon: -97.74 };
let LOCATION = DEFAULT_LOCATION;
let apiCallCount = 0;

function incrementApiCounter() {
  apiCallCount++;
  document.getElementById(
    "api-counter"
  ).textContent = `API Calls: ${apiCallCount}`;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAYS_OF_WEEK_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GRAPH_COLORS = {
  temp: "#ebe834",
  cloud: "#888888",
  precip: "#4da6ff",
  wind: "#ff6b6b",
};

// Utility function to format date for API
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:00`;
}

// Function to update weather data for new location
function updateLocation(lat, lon) {
  // Only clear cache if location has changed
  const locationChanged = LOCATION.lat !== lat || LOCATION.lon !== lon;

  LOCATION = { lat, lon };

  // Save latitude and longitude to cookies
  setCookie("latitude", lat);
  setCookie("longitude", lon);

  if (locationChanged) {
    weatherCache.clear();
  }

  const minTempInput = document.getElementById("min-temp-highlight");
  const minTemp = parseInt(minTempInput.value) || 70;
  fetchTemperatureGraph(lat, lon, 96, minTemp);
}

// Global variable to store current graph data for redrawing
let currentGraphData = null;

// Cache for weather data with 15-minute expiration using localStorage
const weatherCache = {
  _loadFromStorage() {
    try {
      const cached = localStorage.getItem("weatherCache");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error("Error loading cache from localStorage:", e);
    }
    return {
      forecastData: null,
      temperatureData: null,
      timestamp: null,
      location: null,
    };
  },
  _saveToStorage(data) {
    try {
      localStorage.setItem("weatherCache", JSON.stringify(data));
    } catch (e) {
      console.error("Error saving cache to localStorage:", e);
    }
  },
  isValid(lat, lon) {
    const cached = this._loadFromStorage();
    if (!cached.timestamp || !cached.location) {
      console.log("Cache invalid: No timestamp or location");
      return false;
    }
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    const timeValid = now - cached.timestamp < fifteenMinutes;

    // Use Number() to ensure proper comparison and round to avoid floating point issues
    const latMatch = Math.abs(Number(cached.location.lat) - Number(lat)) < 0.01;
    const lonMatch = Math.abs(Number(cached.location.lon) - Number(lon)) < 0.01;
    const locationMatch = latMatch && lonMatch;

    if (!timeValid) {
      console.log(
        `Cache expired (${Math.round(
          (now - cached.timestamp) / 1000 / 60
        )} minutes old)`
      );
    }
    if (!locationMatch) {
      console.log(
        `Location mismatch: cached (${cached.location.lat}, ${cached.location.lon}) vs requested (${lat}, ${lon})`
      );
    }
    if (timeValid && locationMatch) {
      console.log(
        `Cache is valid (${Math.round(
          (fifteenMinutes - (now - cached.timestamp)) / 1000 / 60
        )} minutes remaining)`
      );
    }

    return timeValid && locationMatch;
  },
  setForecast(data, lat, lon) {
    const cached = this._loadFromStorage();
    // Always update location and timestamp when saving new data
    cached.location = { lat, lon };
    cached.timestamp = Date.now();
    cached.forecastData = data;
    this._saveToStorage(cached);
    console.log("Forecast data cached with new timestamp");
  },
  setTemperature(data, lat, lon) {
    const cached = this._loadFromStorage();
    // Always update location and timestamp when saving new data
    cached.location = { lat, lon };
    cached.timestamp = Date.now();
    cached.temperatureData = data;
    this._saveToStorage(cached);
    console.log("Temperature data cached with new timestamp");
  },
  getForecast(lat, lon) {
    if (!this.isValid(lat, lon)) {
      // Clear expired cache as a safeguard
      const cached = this._loadFromStorage();
      if (cached.timestamp) {
        console.log("Clearing expired/invalid cache");
        this.clear();
      }
      return null;
    }
    const cached = this._loadFromStorage();
    return cached.forecastData;
  },
  getTemperature(lat, lon) {
    if (!this.isValid(lat, lon)) {
      // Clear expired cache as a safeguard
      const cached = this._loadFromStorage();
      if (cached.timestamp) {
        console.log("Clearing expired/invalid cache");
        this.clear();
      }
      return null;
    }
    const cached = this._loadFromStorage();
    return cached.temperatureData;
  },
  clear() {
    this._saveToStorage({
      forecastData: null,
      temperatureData: null,
      timestamp: null,
      location: null,
    });
    console.log("Weather cache cleared");
  },
};

const directions = {
  N: [337.5, 22.5],
  NE: [22.5, 67.5],
  E: [67.5, 112.5],
  SE: [112.5, 157.5],
  S: [157.5, 202.5],
  SW: [202.5, 247.5],
  W: [247.5, 292.5],
  NW: [292.5, 337.5],
};

function degreeToDirection(degrees) {
  for (direction in directions) {
    if (
      (direction === "N" && degrees > directions[direction][0]) ||
      degrees <= directions[direction][1]
    ) {
      return direction;
    } else if (
      direction !== "N" &&
      degrees > directions[direction][0] &&
      degrees <= directions[direction][1]
    ) {
      return direction;
    }
  }
  throw new Error("could not determine direction");
}

async function fetchTemperatureGraph(
  latitude,
  longitude,
  hours,
  minTempHighlight
) {
  // Check cache first
  const cachedData = weatherCache.getTemperature(latitude, longitude);
  let data;

  if (cachedData) {
    console.log("Using cached temperature data");
    data = cachedData;
  } else {
    console.log("Fetching fresh temperature data");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,cloud_cover,precipitation_probability,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago`;

    try {
      incrementApiCounter();
      const response = await fetch(url);
      data = await response.json();

      // Store in cache
      weatherCache.setTemperature(data, latitude, longitude);
    } catch (error) {
      console.error("Error fetching temperature graph:", error);
      document.querySelector("#weather-graph").textContent =
        "Error loading graph";
      return;
    }
  }

  try {
    // Get current time and find next hour in local timezone
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    const nextHourTime = formatDateForAPI(nextHour);

    const startIndex = data.hourly.time.indexOf(nextHourTime);

    if (startIndex !== -1 && startIndex + hours <= data.hourly.time.length) {
      // Get hours of data starting from next hour
      const times = data.hourly.time.slice(startIndex, startIndex + hours);
      const temps = data.hourly.temperature_2m.slice(
        startIndex,
        startIndex + hours
      );
      const cloudCover = data.hourly.cloud_cover.slice(
        startIndex,
        startIndex + hours
      );
      const precipProb = data.hourly.precipitation_probability.slice(
        startIndex,
        startIndex + hours
      );
      const windSpeed = data.hourly.wind_speed_10m.slice(
        startIndex,
        startIndex + hours
      );

      // Store current graph data for redrawing
      currentGraphData = { times, temps, cloudCover, precipProb, windSpeed };

      // Create the graph
      drawTemperatureGraph({
        divId: "#weather-graph",
        times,
        temps,
        cloudCover,
        precipProb,
        windSpeed,
        minTempHighlight,
      });

      // draw second graph using sample data
      if (sampleData) {
        drawTemperatureGraph({
          divId: "#sampledata",
          ...sampleData,
          minTempHighlight,
        });
      } else {
        console.log("missing sample data");
      }
    } else {
      document.querySelector("#weather-graph").textContent =
        "Graph data not available";
    }
  } catch (error) {
    console.error("Error processing temperature graph:", error);
    document.querySelector("#weather-graph").textContent =
      "Error loading graph";
  }
}

function drawTemperatureGraph({
  divId,
  times,
  temps,
  cloudCover,
  precipProb,
  windSpeed,
  minTempHighlight,
}) {
  const maxCloudCover = 80;
  const maxWind = 17;
  const maxPrecip = 40;
  const graphContainer = document.querySelector(divId);
  graphContainer.innerHTML = "";

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 400;
  graphContainer.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const padding = 40;
  const graphWidth = canvas.width - 2 * padding;
  const graphHeight = canvas.height - 2 * padding - 60; // Extra space for legend
  const dataPoints = temps.length;

  // Find min and max temps for scaling
  const minTemp = Math.floor(Math.min(...temps) - 5);
  const maxTemp = Math.ceil(Math.max(...temps) + 5);
  const tempRange = maxTemp - minTemp;

  // Clear canvas
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid lines and temperature labels
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = padding + (graphHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(canvas.width - padding, y);
    ctx.stroke();

    // Temperature labels (left side)
    const temp = maxTemp - (tempRange / 5) * i;
    ctx.fillStyle = "#eeeeee";
    ctx.font = "12px Arial";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(temp) + "\u00b0F", padding - 5, y + 4);
  }

  // Draw percentage labels (right side)
  ctx.textAlign = "left";
  for (let i = 0; i <= 5; i++) {
    const y = padding + (graphHeight / 5) * i;
    const percent = 100 - (100 / 5) * i;
    ctx.fillStyle = "#eeeeee";
    ctx.fillText(Math.round(percent) + "%", canvas.width - padding + 5, y + 4);
  }

  // Draw highlights for precipitation and temperature
  temps.forEach((temp, i) => {
    const x = padding + (graphWidth / (dataPoints - 1)) * i;
    const width = i < dataPoints - 1 ? graphWidth / (dataPoints - 1) : 0;

    if (precipProb[i] > maxPrecip) {
      // Draw grey highlight for high precipitation
      ctx.fillStyle = GRAPH_COLORS.precip + "33";
      ctx.fillRect(x - width / 2, padding, width, graphHeight);
    } else if (windSpeed[i] > maxWind) {
      // Draw grey highlight for high precipitation
      ctx.fillStyle = GRAPH_COLORS.wind + "33";
      ctx.fillRect(x - width / 2, padding, width, graphHeight);
    } else if (cloudCover[i] > maxCloudCover) {
      // Draw grey highlight for high precipitation
      ctx.fillStyle = GRAPH_COLORS.cloud + "33";
      ctx.fillRect(x - width / 2, padding, width, graphHeight);
    } else if (temp > minTempHighlight) {
      // Draw orange highlight for high temperature (only if precip is low)
      ctx.fillStyle = GRAPH_COLORS.temp + "33";
      ctx.fillRect(x - width / 2, padding, width, graphHeight);
    }
  });

  // Draw vertical grid lines at midnight, 6am, 12pm, and 6pm
  ctx.strokeStyle = "#195117ff";
  ctx.lineWidth = 1;
  for (let i = 0; i < dataPoints; i++) {
    const time = new Date(times[i]);
    const hour = time.getHours();
    if (hour === 0 || hour === 6 || hour === 12 || hour === 18) {
      if (hour === 0) ctx.lineWidth = 3;
      else ctx.lineWidth = 1;
      const x = padding + (graphWidth / (dataPoints - 1)) * i;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, padding + graphHeight);
      ctx.stroke();
    }
  }

  // Helper function to draw lines
  function drawLine(data, color, scaleFunction) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((value, i) => {
      const x = padding + (graphWidth / (dataPoints - 1)) * i;
      const y = scaleFunction(value);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }

  // Draw cloud cover line
  drawLine(
    cloudCover,
    GRAPH_COLORS.cloud,
    (cloud) => padding + graphHeight - (cloud / 100) * graphHeight
  );

  // Draw precipitation probability line
  drawLine(
    precipProb,
    GRAPH_COLORS.precip,
    (precip) => padding + graphHeight - (precip / 100) * graphHeight
  );

  // Draw temperature line
  drawLine(
    temps,
    GRAPH_COLORS.temp,
    (temp) =>
      padding + graphHeight - ((temp - minTemp) / tempRange) * graphHeight
  );

  // Draw wind speed line (scaled 0-20 mph)
  drawLine(
    windSpeed,
    GRAPH_COLORS.wind,
    (wind) => padding + graphHeight - (Math.min(wind, 20) / 20) * graphHeight
  );

  // Helper function to draw points at specified hours
  function drawPointsAtHours(data, color, scaleFunction) {
    ctx.fillStyle = color;
    data.forEach((value, i) => {
      const time = new Date(times[i]);
      const hour = time.getHours();
      if (hour % 3 === 0) {
        const x = padding + (graphWidth / (dataPoints - 1)) * i;
        const y = scaleFunction(value);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  }

  // Draw points on cloud cover line (at midnight, 3am, 6am, etc.)
  drawPointsAtHours(
    cloudCover,
    GRAPH_COLORS.cloud,
    (cloud) => padding + graphHeight - (cloud / 100) * graphHeight
  );

  // Draw points on precipitation line (at midnight, 3am, 6am, etc.)
  drawPointsAtHours(
    precipProb,
    GRAPH_COLORS.precip,
    (precip) => padding + graphHeight - (precip / 100) * graphHeight
  );

  // Draw points on temperature line (at midnight, 3am, 6am, etc.)
  drawPointsAtHours(
    temps,
    GRAPH_COLORS.temp,
    (temp) =>
      padding + graphHeight - ((temp - minTemp) / tempRange) * graphHeight
  );

  // Draw points on wind speed line (at midnight, 3am, 6am, etc.)
  drawPointsAtHours(
    windSpeed,
    GRAPH_COLORS.wind,
    (wind) => padding + graphHeight - (Math.min(wind, 20) / 20) * graphHeight
  );

  // Draw time labels at midnight, 6am, 12pm, and 6pm
  temps.forEach((temp, i) => {
    const time = new Date(times[i]);
    const hour = time.getHours();
    if (hour === 0 || hour === 6 || hour === 12 || hour === 18) {
      const x = padding + (graphWidth / (dataPoints - 1)) * i;
      const day = time.getDate();
      const label =
        hour === 0
          ? "12am"
          : hour < 12
          ? hour + "am"
          : hour === 12
          ? "12pm"
          : hour - 12 + "pm";
      ctx.fillStyle = "#eeeeee";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(label, x, padding + graphHeight + 15);
      // Add day marker at midnight
      if (hour === 0) {
        const dayName = DAYS_OF_WEEK_SHORT[time.getDay()];
        ctx.fillText(dayName, x, padding + graphHeight + 28);
      }
    }
  });

  // Draw legend
  const legendY = padding + graphHeight + 35;
  const legendSpacing = 150;
  const legendItems = [
    { color: GRAPH_COLORS.temp, label: "Temperature" },
    { color: GRAPH_COLORS.cloud, label: "Cloud Cover" },
    { color: GRAPH_COLORS.precip, label: "Precipitation %" },
    { color: GRAPH_COLORS.wind, label: "Wind Speed" },
  ];

  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  legendItems.forEach((item, i) => {
    const x = padding + legendSpacing * i;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, legendY, 20, 3);
    ctx.fillStyle = "#eeeeee";
    ctx.fillText(item.label, x + 25, legendY + 4);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Load saved values from cookies
  const savedLat = getCookie("latitude");
  const savedLon = getCookie("longitude");
  const savedMinTemp = getCookie("minTempHighlight");

  // Update input fields with saved values if they exist
  if (savedLat !== null) {
    document.getElementById("latitude").value = savedLat;
    LOCATION.lat = parseFloat(savedLat);
  }
  if (savedLon !== null) {
    document.getElementById("longitude").value = savedLon;
    LOCATION.lon = parseFloat(savedLon);
  }
  if (savedMinTemp !== null) {
    document.getElementById("min-temp-highlight").value = savedMinTemp;
  }

  const initialMinTemp =
    parseInt(document.getElementById("min-temp-highlight").value) || 70;

  fetchTemperatureGraph(LOCATION.lat, LOCATION.lon, 96, initialMinTemp);

  // Add input event listener for minimum temperature highlight
  const minTempInput = document.getElementById("min-temp-highlight");

  // Add event listener for location update
  const submitButton = document.getElementById("submit-location");
  submitButton.addEventListener("click", () => {
    const lat = parseFloat(document.getElementById("latitude").value);
    const lon = parseFloat(document.getElementById("longitude").value);

    if (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      updateLocation(lat, lon);
    } else {
      alert(
        "Please enter valid latitude (-90 to 90) and longitude (-180 to 180)"
      );
    }
  });

  // Only allow numbers
  minTempInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");

    const value = parseInt(e.target.value);

    // Save to cookie
    if (!isNaN(value) && value >= 10) {
      setCookie("minTempHighlight", value);
    }

    // Only redraw if >= 10 and we have graph data
    if (!isNaN(value) && value >= 10 && currentGraphData) {
      drawTemperatureGraph({
        divId: "#weather-graph",
        ...currentGraphData,
        minTempHighlight: value,
      });
    }
  });

  // Refresh graph data every 60 minutes
  setInterval(() => {
    const currentLat = parseFloat(document.getElementById("latitude").value);
    const currentLon = parseFloat(document.getElementById("longitude").value);
    const currentMinTemp = parseInt(minTempInput.value) || 70;

    // Clear cache to force fresh data
    weatherCache.clear();

    // Refresh graph with current values
    fetchTemperatureGraph(currentLat, currentLon, 96, currentMinTemp);
  }, 60 * 60 * 1000);
});

const sampleData_orig = {
  times: [
    "2025-12-08T03:00",
    "2025-12-08T04:00",
    "2025-12-08T05:00",
    "2025-12-08T06:00",
    "2025-12-08T07:00",
    "2025-12-08T08:00",
    "2025-12-08T09:00",
    "2025-12-08T10:00",
    "2025-12-08T11:00",
    "2025-12-08T12:00",
    "2025-12-08T13:00",
    "2025-12-08T14:00",
    "2025-12-08T15:00",
    "2025-12-08T16:00",
    "2025-12-08T17:00",
    "2025-12-08T18:00",
    "2025-12-08T19:00",
    "2025-12-08T20:00",
    "2025-12-08T21:00",
    "2025-12-08T22:00",
    "2025-12-08T23:00",
    "2025-12-09T00:00",
    "2025-12-09T01:00",
    "2025-12-09T02:00",
    "2025-12-09T03:00",
    "2025-12-09T04:00",
    "2025-12-09T05:00",
    "2025-12-09T06:00",
    "2025-12-09T07:00",
    "2025-12-09T08:00",
    "2025-12-09T09:00",
    "2025-12-09T10:00",
    "2025-12-09T11:00",
    "2025-12-09T12:00",
    "2025-12-09T13:00",
    "2025-12-09T14:00",
    "2025-12-09T15:00",
    "2025-12-09T16:00",
    "2025-12-09T17:00",
    "2025-12-09T18:00",
    "2025-12-09T19:00",
    "2025-12-09T20:00",
    "2025-12-09T21:00",
    "2025-12-09T22:00",
    "2025-12-09T23:00",
    "2025-12-10T00:00",
    "2025-12-10T01:00",
    "2025-12-10T02:00",
    "2025-12-10T03:00",
    "2025-12-10T04:00",
    "2025-12-10T05:00",
    "2025-12-10T06:00",
    "2025-12-10T07:00",
    "2025-12-10T08:00",
    "2025-12-10T09:00",
    "2025-12-10T10:00",
    "2025-12-10T11:00",
    "2025-12-10T12:00",
    "2025-12-10T13:00",
    "2025-12-10T14:00",
    "2025-12-10T15:00",
    "2025-12-10T16:00",
    "2025-12-10T17:00",
    "2025-12-10T18:00",
    "2025-12-10T19:00",
    "2025-12-10T20:00",
    "2025-12-10T21:00",
    "2025-12-10T22:00",
    "2025-12-10T23:00",
    "2025-12-11T00:00",
    "2025-12-11T01:00",
    "2025-12-11T02:00",
    "2025-12-11T03:00",
    "2025-12-11T04:00",
    "2025-12-11T05:00",
    "2025-12-11T06:00",
    "2025-12-11T07:00",
    "2025-12-11T08:00",
    "2025-12-11T09:00",
    "2025-12-11T10:00",
    "2025-12-11T11:00",
    "2025-12-11T12:00",
    "2025-12-11T13:00",
    "2025-12-11T14:00",
    "2025-12-11T15:00",
    "2025-12-11T16:00",
    "2025-12-11T17:00",
    "2025-12-11T18:00",
    "2025-12-11T19:00",
    "2025-12-11T20:00",
    "2025-12-11T21:00",
    "2025-12-11T22:00",
    "2025-12-11T23:00",
    "2025-12-12T00:00",
    "2025-12-12T01:00",
    "2025-12-12T02:00",
  ],
  temps: [
    45.4, 44.1, 42.8, 41.4, 40.3, 41.6, 45, 48.9, 53.2, 56.9, 59.4, 60.5, 80.7,
    59.8, 57.5, 51.3, 48.1, 45, 42.9, 41.3, 40, 39.1, 38.2, 37.2, 36.1, 35.5,
    35.1, 35, 34.6, 35.5, 42.9, 48.7, 54.3, 58.3, 61.6, 63.8, 65.1, 64.9, 62.1,
    55.4, 52.1, 49.7, 48.6, 48.2, 48.2, 49.1, 50.3, 50, 49.9, 49.7, 49.3, 49.4,
    49.3, 50.9, 56.5, 61.9, 66.6, 70.7, 74.2, 76, 74.6, 72, 67, 61.1, 58.6,
    57.5, 55.7, 53.7, 52.3, 51.1, 50, 49.1, 48.4, 48, 47.1, 46.5, 46, 47.8,
    52.4, 56.8, 60.6, 63.7, 66.2, 68.2, 69.1, 69.3, 66.2, 61.7, 59.9, 58.8,
    58.1, 57.4, 57, 56.6, 56.5, 56.7,
  ],
  cloudCover: [
    0, 0, 0, 2, 1, 2, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
    1, 2, 2, 3, 3, 7, 4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 7, 100, 100, 100, 7, 100, 7, 7,
    11, 21, 100, 100, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  precipProb: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  windSpeed: [
    13.1, 13.5, 12.3, 9.7, 10.9, 11.6, 13, 13.5, 13.6, 12.5, 12.1, 11.5, 10.8,
    10, 7.7, 6.2, 6.8, 5.8, 4.3, 1.8, 1.6, 2.7, 4.9, 2.6, 6.5, 3.6, 3.2, 4.4,
    6.8, 5.2, 2, 5.5, 9.4, 10.5, 11.7, 11.7, 11.8, 11.3, 9.8, 8, 7.4, 6, 8.1,
    7.8, 7.9, 8.5, 8.7, 8.1, 8.4, 8.4, 7.3, 8, 7.1, 7.8, 9, 8.5, 6.5, 6.3, 5.8,
    9.1, 13.5, 14.5, 14.2, 11.4, 10.9, 12.5, 10.7, 9.6, 9.1, 8.9, 7.4, 7.4, 6.1,
    6.6, 7.4, 6.1, 5.4, 4.4, 5, 5.5, 3.4, 3.3, 5.4, 6.7, 7.7, 8.3, 6.5, 7.4,
    7.2, 7.9, 7.4, 7.4, 6.9, 7.1, 6.7, 5.9,
  ],
  minTempHighlight: 70,
};

const sampleData = {
  times: [
    "2025-12-08T03:00",
    "2025-12-08T04:00",
    "2025-12-08T05:00",
    "2025-12-08T06:00",
    "2025-12-08T07:00",
    "2025-12-08T08:00",
    "2025-12-08T09:00",
    "2025-12-08T10:00",
    "2025-12-08T11:00",
    "2025-12-08T12:00",
    "2025-12-08T13:00",
    "2025-12-08T14:00",
    "2025-12-08T15:00",
    "2025-12-08T16:00",
    "2025-12-08T17:00",
    "2025-12-08T18:00",
    "2025-12-08T19:00",
    "2025-12-08T20:00",
    "2025-12-08T21:00",
    "2025-12-08T22:00",
    "2025-12-08T23:00",
    "2025-12-09T00:00",
    "2025-12-09T01:00",
    "2025-12-09T02:00",
    "2025-12-09T03:00",
    "2025-12-09T04:00",
    "2025-12-09T05:00",
    "2025-12-09T06:00",
    "2025-12-09T07:00",
    "2025-12-09T08:00",
    "2025-12-09T09:00",
    "2025-12-09T10:00",
    "2025-12-09T11:00",
    "2025-12-09T12:00",
    "2025-12-09T13:00",
    "2025-12-09T14:00",
    "2025-12-09T15:00",
    "2025-12-09T16:00",
    "2025-12-09T17:00",
    "2025-12-09T18:00",
    "2025-12-09T19:00",
    "2025-12-09T20:00",
    "2025-12-09T21:00",
    "2025-12-09T22:00",
    "2025-12-09T23:00",
    "2025-12-10T00:00",
    "2025-12-10T01:00",
    "2025-12-10T02:00",
    "2025-12-10T03:00",
    "2025-12-10T04:00",
    "2025-12-10T05:00",
    "2025-12-10T06:00",
    "2025-12-10T07:00",
    "2025-12-10T08:00",
    "2025-12-10T09:00",
    "2025-12-10T10:00",
    "2025-12-10T11:00",
    "2025-12-10T12:00",
    "2025-12-10T13:00",
    "2025-12-10T14:00",
    "2025-12-10T15:00",
    "2025-12-10T16:00",
    "2025-12-10T17:00",
    "2025-12-10T18:00",
    "2025-12-10T19:00",
    "2025-12-10T20:00",
    "2025-12-10T21:00",
    "2025-12-10T22:00",
    "2025-12-10T23:00",
    "2025-12-11T00:00",
    "2025-12-11T01:00",
    "2025-12-11T02:00",
    "2025-12-11T03:00",
    "2025-12-11T04:00",
    "2025-12-11T05:00",
    "2025-12-11T06:00",
    "2025-12-11T07:00",
    "2025-12-11T08:00",
    "2025-12-11T09:00",
    "2025-12-11T10:00",
    "2025-12-11T11:00",
    "2025-12-11T12:00",
    "2025-12-11T13:00",
    "2025-12-11T14:00",
    "2025-12-11T15:00",
    "2025-12-11T16:00",
    "2025-12-11T17:00",
    "2025-12-11T18:00",
    "2025-12-11T19:00",
    "2025-12-11T20:00",
    "2025-12-11T21:00",
    "2025-12-11T22:00",
    "2025-12-11T23:00",
    "2025-12-12T00:00",
    "2025-12-12T01:00",
    "2025-12-12T02:00",
  ],
  temps: [
    45.0, 45.65, 47.55, 50.56, 54.45, 58.94, 63.69, 68.36, 72.59, 76.07, 78.55,
    79.84, 79.84, 78.55, 76.07, 72.59, 68.36, 63.69, 58.94, 54.45, 50.56, 47.55,
    45.65, 45.0, 45.0, 45.65, 47.55, 50.56, 54.45, 58.94, 63.69, 68.36, 72.59,
    76.07, 78.55, 79.84, 79.84, 78.55, 76.07, 72.59, 68.36, 63.69, 58.94, 54.45,
    50.56, 47.55, 45.65, 45.0, 45.0, 45.65, 47.55, 50.56, 54.45, 58.94, 63.69,
    68.36, 72.59, 76.07, 78.55, 79.84, 79.84, 78.55, 76.07, 72.59, 68.36, 63.69,
    58.94, 54.45, 50.56, 47.55, 45.65, 45.0, 45.0, 45.65, 47.55, 50.56, 54.45,
    58.94, 63.69, 68.36, 72.59, 76.07, 78.55, 79.84, 79.84, 78.55, 76.07, 72.59,
    68.36, 63.69, 58.94, 54.45, 50.56, 47.55, 45.65, 45.0,
  ],
  cloudCover: [
    0, 0, 0, 2, 1, 2, 3, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.0,
    1.85, 7.28, 15.87, 27.0, 39.83, 53.41, 66.74, 78.83, 88.79, 95.86, 99.53,
    99.53, 95.86, 88.79, 78.83, 66.74, 53.41, 39.83, 27.0, 15.87, 7.28, 1.85,
    0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 7, 0, 0, 0, 7, 0, 7,
    0, 11, 21, 0, 0, 31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  precipProb: [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0,
    1.85, 7.28, 15.87, 27.0, 39.83, 53.41, 66.74, 78.83, 88.79, 95.86, 99.53,
    99.53, 95.86, 88.79, 78.83, 66.74, 53.41, 39.83, 27.0, 15.87, 7.28, 1.85,
    0.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  windSpeed: [
    5, 13.5, 12.3, 9.7, 10.9, 11.6, 13, 13.5, 13.6, 12.5, 12.1, 11.5, 10, 10,
    7.7, 6.2, 6.8, 5.8, 4.3, 1.8, 1.6, 2.7, 4.9, 2.6, 5, 3.6, 3.2, 4.4, 6.8,
    5.2, 2, 5.5, 9.4, 10.5, 11.7, 11.7, 10, 11.3, 9.8, 8, 7.4, 6, 8.1, 7.8, 7.9,
    8.5, 8.7, 8.1, 5, 8.4, 7.3, 8, 7.1, 7.8, 9, 8.5, 6.5, 6.3, 5.8, 9.1, 10,
    14.5, 14.2, 11.4, 10.9, 12.5, 10.7, 9.6, 9.1, 8.9, 7.4, 7.4, 0.0, 0.5, 1.8,
    4.0, 6.7, 10.0, 13.4, 16.7, 19.7, 22.2, 24.0, 24.9, 24.9, 24.0, 22.2, 19.7,
    16.7, 13.4, 10.0, 6.7, 4.0, 1.8, 0.5, 0.0,
  ],
};
