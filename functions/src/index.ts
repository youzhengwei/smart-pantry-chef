import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const getNearbyStores = functions.https.onCall(async (data: any, context) => {
  const { lat, lng } = data as { lat: number; lng: number };

  if (!lat || !lng) {
    throw new functions.https.HttpsError('invalid-argument', 'Latitude and longitude are required');
  }

  const apiKey = "AIzaSyCNTseVNzqOlouqea9KGUP7VyCpaZvx1So";

  const url = 'https://places.googleapis.com/v1/places:searchNearby';
  const requestBody = {
    includedTypes: ["supermarket", "grocery_or_supermarket"],
    locationRestriction: {
      circle: {
        center: {
          latitude: lat,
          longitude: lng
        },
        radius: 3000.0
      }
    },
    maxResultCount: 20
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.currentOpeningHours'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Places API error: ${response.status}`);
    }

    const result = await response.json();
    return result.places || [];
  } catch (error) {
    console.error('Error calling Places API:', error);
    throw new functions.https.HttpsError('internal', 'Failed to fetch nearby stores');
  }
});