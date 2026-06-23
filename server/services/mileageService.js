const OFFICE_ADDRESS = '9250 Mosby St, Manassas VA 20110';
const ORS_BASE_URL = 'https://api.openrouteservice.org';
const ORS_API_KEY = process.env.ORS_API_KEY;

// Geocode an address to coordinates using OpenRouteService
async function geocodeAddress(address) {
  if (!ORS_API_KEY) {
    throw new Error('ORS_API_KEY environment variable is not set');
  }

  const encodedAddress = encodeURIComponent(address);
  const url = `${ORS_BASE_URL}/geocode/search?text=${encodedAddress}&boundary.country=US&size=1&api_key=${ORS_API_KEY}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': ORS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error(`Address not found: ${address}`);
  }

  const [lon, lat] = data.features[0].geometry.coordinates;
  return { lat, lon };
}

// Calculate driving distance between two points using OpenRouteService
async function getDistance(originCoords, destCoords) {
  const url = `${ORS_BASE_URL}/v2/directions/driving-car?api_key=${ORS_API_KEY}&start=${originCoords.lon},${originCoords.lat}&end=${destCoords.lon},${destCoords.lat}`;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'Authorization': ORS_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`Directions API failed: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error('No route found');
  }

  // Distance is in meters
  const distanceMeters = data.features[0].properties.summary.distance;
  return distanceMeters;
}

// Convert meters to miles
function metersToMiles(meters) {
  return meters * 0.000621371;
}

// Calculate round-trip mileage from office to destination
async function calculateMileage(destinationAddress) {
  if (!destinationAddress) {
    throw new Error('Destination address is required');
  }

  // Geocode both addresses
  const [originCoords, destCoords] = await Promise.all([
    geocodeAddress(OFFICE_ADDRESS),
    geocodeAddress(destinationAddress),
  ]);

  // Get one-way distance
  const distanceMeters = await getDistance(originCoords, destCoords);

  // Convert to miles and double for round trip
  const oneWayMiles = metersToMiles(distanceMeters);
  const roundTripMiles = oneWayMiles * 2;

  // Round to 1 decimal place
  return Math.round(roundTripMiles * 10) / 10;
}

module.exports = {
  calculateMileage,
  OFFICE_ADDRESS,
};
