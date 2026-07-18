import fetch from 'node-fetch';

async function testApiFootball() {
  const apiKey = "7042e46eb559f59187b674889b0257d1";
  const apiHost = "v3.football.api-sports.io";
  const url = `https://${apiHost}/fixtures?league=1&season=2026`;
  console.log(`Testing API-Football: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
        "x-rapidapi-key": apiKey,
        "x-apisports-host": apiHost
      }
    });
    console.log("API-Football Response Status:", res.status);
    const text = await res.text();
    console.log("API-Football Response Body snippet:", text.substring(0, 200));
  } catch (err) {
    console.error("API-Football Error:", err);
  }
}

async function testFootballData() {
  const key = "2a0cdc4facce4172818124d35506bc28";
  const url = "https://api.football-data.org/v4/competitions/WC/matches?season=2026";
  console.log(`Testing Football-Data: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        "X-Auth-Token": key
      }
    });
    console.log("Football-Data Response Status:", res.status);
    const text = await res.text();
    console.log("Football-Data Response Body snippet:", text.substring(0, 200));
  } catch (err) {
    console.error("Football-Data Error:", err);
  }
}

async function run() {
  await testApiFootball();
  await testFootballData();
}

run();
