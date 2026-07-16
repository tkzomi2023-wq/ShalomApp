import fetch from 'node-fetch';

const apiKey = "7bd67bdab71254a48036fa1eff71ed21";
const apiHost = "v3.football.api-sports.io";

async function test() {
  try {
    const res = await fetch(`https://${apiHost}/standings?league=1&season=2022`, {
      headers: {
        "x-apisports-key": apiKey,
        "x-apisports-host": apiHost
      }
    });
    const payload = await res.json();
    console.log("Status:", res.status);
    console.log("Errors:", JSON.stringify(payload.errors));
    console.log("Results count:", payload.results);
    if (payload.response && payload.response.length > 0) {
      console.log("First fixture:", JSON.stringify(payload.response[0], null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
