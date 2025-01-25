require("dotenv").config();
const express = require("express");
const redis = require("redis");
const axios = require("axios");
const rateLimit = require("express-rate-limit");

const app = express();
const client = redis.createClient({ url: process.env.REDIS_URL });

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Too many requests, please try again later.",
});
app.use(limiter);

// Redis error handling
client.on("error", (err) => console.log("Redis Client Error", err));

// Connect to Redis
client
  .connect()
  .then(() => console.log("Connected to Redis"))
  .catch((err) => console.error("Failed to connect to Redis:", err));

// Weather API endpoint
app.get("/weather/:city", async (req, res) => {
  const city = req.params.city;

  // Check cache first
  try {
    const cachedData = await client.get(city);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }
  } catch (err) {
    console.error("Redis cache error:", err);
  }

  // Fetch data from Visual Crossing API
  const apiKey = process.env.WEATHER_API_KEY;
  const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${city}?key=${apiKey}`;

  try {
    const response = await axios.get(url);
    const weatherData = response.data;

    // Cache the data in Redis
    try {
      await client.set(city, JSON.stringify(weatherData), { EX: 43200 }); // 12 hours expiration
    } catch (err) {
      console.error("Failed to cache data in Redis:", err);
    }

    res.json(weatherData);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      res.status(404).json({ error: "City not found" });
    } else {
      console.error("Failed to fetch weather data:", error.message);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  }
});

// Start the server
app.listen(3000, () => {
  console.log("Weather API server is running on port 3000");
});
