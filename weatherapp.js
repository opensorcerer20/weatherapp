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

  // Clear existing weather boxes
  for (let i = 0; i < 4; i++) {
    document.querySelector(`#bikeday${i}`).textContent = "Loading...";
  }

  // Fetch new data
  for (let i = 0; i < 4; i++) {
    fetchForecast(lat, lon, i, `#bikeday${i}`);
  }

  const minTempInput = document.getElementById("min-temp-highlight");
  const minTemp = parseInt(minTempInput.value) || 70;
  fetchTemperatureGraph(lat, lon, 96, minTemp);
}

// Global variable to store current graph data for redrawing
let currentGraphData = null;

// Cache for weather data with 15-minute expiration
const weatherCache = {
  forecastData: null,
  temperatureData: null,
  timestamp: null,
  location: null,
  isValid(lat, lon) {
    if (!this.timestamp || !this.location) return false;
    const now = Date.now();
    const fifteenMinutes = 15 * 60 * 1000;
    const timeValid = now - this.timestamp < fifteenMinutes;
    const locationMatch =
      this.location.lat === lat && this.location.lon === lon;
    return timeValid && locationMatch;
  },
  setForecast(data, lat, lon) {
    if (
      !this.location ||
      this.location.lat !== lat ||
      this.location.lon !== lon
    ) {
      this.location = { lat, lon };
      this.timestamp = Date.now();
    }
    this.forecastData = data;
  },
  setTemperature(data, lat, lon) {
    if (
      !this.location ||
      this.location.lat !== lat ||
      this.location.lon !== lon
    ) {
      this.location = { lat, lon };
      this.timestamp = Date.now();
    }
    this.temperatureData = data;
  },
  getForecast(lat, lon) {
    return this.isValid(lat, lon) ? this.forecastData : null;
  },
  getTemperature(lat, lon) {
    return this.isValid(lat, lon) ? this.temperatureData : null;
  },
  clear() {
    this.forecastData = null;
    this.temperatureData = null;
    this.timestamp = null;
    this.location = null;
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

async function fetchForecast(
  latitude,
  longitude,
  daysFromNow,
  elementSelector
) {
  // Check cache first
  const cachedData = weatherCache.getForecast(latitude, longitude);
  let data;

  if (cachedData) {
    console.log("Using cached forecast data");
    data = cachedData;
  } else {
    console.log("Fetching fresh forecast data");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,cloud_cover&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/Chicago`;

    try {
      incrementApiCounter();
      const response = await fetch(url);
      data = await response.json();

      // Store in cache
      weatherCache.setForecast(data, latitude, longitude);
    } catch (error) {
      console.error("Error fetching forecast:", error);
      document.querySelector(elementSelector).textContent = "Error loading";
      return;
    }
  }

  try {
    const now = new Date();
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysFromNow);

    // Get forecasts for 3pm, 4pm, and 5pm
    const hours = [15, 16, 17];
    const forecasts = hours
      .map((hour) => {
        const time = new Date(targetDate);
        time.setHours(hour, 0, 0, 0);
        const targetTime = formatDateForAPI(time);

        const index = data.hourly.time.indexOf(targetTime);

        if (index !== -1) {
          return {
            hour: hour > 12 ? hour - 12 : hour,
            period: "pm",
            temp: data.hourly.temperature_2m[index],
            //temp: 80,
            windSpeed: data.hourly.wind_speed_10m[index],
            windDirection: degreeToDirection(
              data.hourly.wind_direction_10m[index]
            ),
            cloudCover: data.hourly.cloud_cover[index],
          };
        }
        return null;
      })
      .filter((f) => f !== null);

    if (forecasts.length > 0) {
      // Get day of week name
      const dayLabel = DAYS_OF_WEEK[targetDate.getDay()];

      const forecastLines = forecasts
        .map(
          (f) =>
            `<div>${f.hour}${f.period}: ${f.temp}°F, wind ${f.windSpeed} mph ${f.windDirection}, clouds: ${f.cloudCover}%</div>`
        )
        .join("");

      // Calculate average temperature
      const avgTemp =
        forecasts.reduce((sum, f) => sum + f.temp, 0) / forecasts.length;
      const tempCheck = avgTemp >= 75 ? "yes" : "no";

      // Calculate average cloud cover
      const avgCloudCover =
        forecasts.reduce((sum, f) => sum + f.cloudCover, 0) / forecasts.length;
      const sunCheck = avgCloudCover < 50 ? "yes" : "no";

      // Change background and text color based on conditions
      const element = document.querySelector(elementSelector);
      if (tempCheck === "yes" && sunCheck === "yes") {
        element.style.backgroundColor = "#ebe834";
        element.style.color = "#121212";
      } else if (tempCheck === "no" && sunCheck === "no") {
        element.style.backgroundColor = "#aaaaaa";
        element.style.color = "#121212";
      } else if (tempCheck === "yes" && sunCheck === "no") {
        element.style.backgroundColor = "#a17a48";
        element.style.color = "#121212";
      } else {
        element.style.backgroundColor = "#761f7b";
        element.style.color = "#eeeeee";
      }

      element.innerHTML = `
        <div>
          <h3>${dayLabel}</h3>
          ${forecastLines}
          <div>&nbsp;</div>
          <div>temperature? ${tempCheck}</div>
          <div>sun? ${sunCheck}</div>
        </div>
      `;
    } else {
      document.querySelector(elementSelector).textContent =
        "Data not available";
    }
  } catch (error) {
    console.error("Error processing forecast:", error);
    document.querySelector(elementSelector).textContent = "Error loading";
  }
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
      drawTemperatureGraph(
        times,
        temps,
        cloudCover,
        precipProb,
        windSpeed,
        minTempHighlight
      );
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

function drawTemperatureGraph(
  times,
  temps,
  cloudCover,
  precipProb,
  windSpeed,
  minTempHighlight
) {
  // Clear existing canvas
  const graphContainer = document.querySelector("#weather-graph");
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

    if (precipProb[i] > 30) {
      // Draw grey highlight for high precipitation
      ctx.fillStyle = "rgba(128, 128, 128, 0.3)";
      ctx.fillRect(x - width / 2, padding, width, graphHeight);
    } else if (temp > minTempHighlight) {
      // Draw orange highlight for high temperature (only if precip is low)
      ctx.fillStyle = "rgba(255, 165, 0, 0.3)";
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

  // Fetch forecasts for 4 days
  for (let i = 0; i < 4; i++) {
    fetchForecast(LOCATION.lat, LOCATION.lon, i, `#bikeday${i}`);
  }
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
      drawTemperatureGraph(
        currentGraphData.times,
        currentGraphData.temps,
        currentGraphData.cloudCover,
        currentGraphData.precipProb,
        currentGraphData.windSpeed,
        value
      );
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
