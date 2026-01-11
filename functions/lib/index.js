"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNearbyStores = exports.searchProducts = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const cheerio = require("cheerio");
const corsLib = require("cors");
admin.initializeApp();
const cors = corsLib({ origin: true });
async function scrapeNtuc(query) {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.fairprice.com.sg/search?query=${encodedQuery}`;
    try {
        const response = await axios_1.default.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const results = [];
        // Find product cards - adjust selectors based on FairPrice website structure
        $('.product-card, .product-item, [data-testid*="product"]').each((index, element) => {
            var _a;
            const $el = $(element);
            // Extract product title
            const title = $el.find('.product-title, .product-name, h3, h4').first().text().trim() ||
                ((_a = $el.find('a').attr('title')) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            // Extract price
            const price = $el.find('.product-price, .price, [data-testid*="price"]').first().text().trim() ||
                $el.find('.price').text().trim() || '';
            // Extract measurement/unit
            const measurement = $el.find('.product-weight, .weight, .unit, .measurement').first().text().trim() || '';
            // Extract product link
            const link = $el.find('a').attr('href');
            const fullLink = link ? (link.startsWith('http') ? link : `https://www.fairprice.com.sg${link}`) : '';
            if (title && price) {
                results.push({
                    supermarket: 'ntuc',
                    title,
                    price,
                    measurement,
                    link: fullLink
                });
            }
        });
        return results.slice(0, 10); // Limit to first 10 results
    }
    catch (error) {
        console.error('Error scraping NTUC:', error);
        throw new functions.https.HttpsError('internal', 'Failed to scrape product data');
    }
}
exports.searchProducts = functions.https.onRequest(async (req, res) => {
    return cors(req, res, async () => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        try {
            const { query } = req.body;
            if (!query || typeof query !== 'string') {
                res.status(400).json({ error: 'Query parameter is required and must be a string' });
                return;
            }
            const results = await scrapeNtuc(query);
            res.json({ results });
        }
        catch (error) {
            console.error('Error in searchProducts:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
});
exports.getNearbyStores = functions.https.onCall(async (data, context) => {
    const { lat, lng } = data;
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
    }
    catch (error) {
        console.error('Error calling Places API:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch nearby stores');
    }
});
//# sourceMappingURL=index.js.map