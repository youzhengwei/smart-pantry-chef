# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Webhook Setup for Recipe Generation

The recipe generation feature uses a Railway/n8n webhook for AI-powered recipe creation. To set it up:

### 1. Environment Configuration

Update your `.env` file with the webhook URL:

```env
VITE_RAILWAY_WEBHOOK_URL=https://your-railway-app.up.railway.app/webhook/generate-recipes
# Optional: Add authentication token if required
# VITE_WEBHOOK_TOKEN=your_webhook_token_here
```

### 2. Railway/n8n Setup

1. Deploy your n8n workflow to Railway
2. Create a webhook node in n8n that listens for POST requests
3. Configure the webhook to:
   - Accept JSON payload with `userId`, `strictOnly`, and `preferenceText`
   - Fetch user inventory from Firebase Firestore
   - Call OpenAI API with the inventory data
   - Return recipes in the expected format

### 3. Webhook Payload Format

The webhook receives:
```json
{
  "userId": "firebase-user-id",
  "strictOnly": true,
  "preferenceText": "Italian cuisine",
  "timestamp": "2025-12-20T10:00:00.000Z"
}
```

Expected response format:
```json
{
  "recipes": [
    {
      "name": "Recipe Name",
      "description": "Brief description",
      "ingredients": ["ingredient 1", "ingredient 2"],
      "instructions": ["step 1", "step 2"],
      "prepTime": 15,
      "cookTime": 30,
      "servings": 4
    }
  ]
}
```

### 4. CORS Configuration

**Important**: Your Railway n8n app must allow cross-origin requests from your frontend. In your n8n workflow:

1. Add a **Webhook** node at the start of your workflow
2. Configure the webhook with:
   - **HTTP Method**: POST
   - **Path**: `/webhook/generate-recipes`
   - **Response Mode**: When Last Node Finishes
   - **Response Data**: All Data

3. **Add CORS Headers**: In your webhook response, include these headers:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization
   ```

4. **Handle OPTIONS requests**: n8n should automatically handle preflight OPTIONS requests, but if you get CORS errors, ensure your webhook accepts OPTIONS method.

### Alternative: Use a CORS Proxy

If you can't configure CORS in n8n, you can use a CORS proxy service or deploy your own Express server with CORS enabled.

## Quick CORS Fix for Testing

For immediate testing, you can use the included CORS proxy server:

1. **Start the CORS proxy** (in a separate terminal):
   ```bash
   npm run cors-proxy
   ```

2. **Update your environment variable**:
   ```env
   VITE_RAILWAY_WEBHOOK_URL=http://localhost:3001/api/generate-recipes
   ```

3. **Restart your dev server** to pick up the environment change.

This proxy will forward requests to your Railway webhook while handling CORS properly.

## Product Search & Store Locator Integration

The app includes a product search feature that scrapes supermarket websites and integrates with Google Places to find nearby stores carrying specific items.

### Backend Setup

The product search functionality uses a standalone Express server that scrapes NTUC FairPrice for product information.

#### Express Server Setup

1. **Navigate to the scraper backend**:
   ```bash
   cd scraper-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run locally for development**:
   ```bash
   npm run dev
   ```

4. **Build and run for production**:
   ```bash
   npm run build
   npm start
   ```

#### Deploy to Render/Railway

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: `PORT` (optional, defaults to 3000)

The server exposes a `/search-products` endpoint that accepts POST requests with:
```json
{
  "query": "Milk 1 kg"
}
```

Response format:
```json
{
  "results": [
    {
      "supermarket": "ntuc",
      "title": "HL Milk Low Fat 1L",
      "price": "$3.20",
      "measurement": "1L",
      "link": "https://www.fairprice.com.sg/product/hl-milk-low-fat-1l-12129496"
    }
  ]
}
```

### N8N Integration for Product Search (Optional)

To integrate with n8n for additional processing:

#### 1. Environment Configuration

Add to your `.env` file:
```env
VITE_N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/search-products
```

#### 2. N8N Workflow Setup

Create an n8n workflow with:

1. **Webhook Node** (Trigger):
   - HTTP Method: POST
   - Path: `/webhook/search-products`
   - Response Mode: When Last Node Finishes

2. **HTTP Request Node** (Call Express Server):
   - Method: POST
   - URL: `https://your-scraper-backend.onrender.com/search-products`
   - Body: `{"query": "{{ $json.query }}"}`

3. **Set Node** (Format Response):
   - Set: `results = {{ $node["HTTP Request"].json.body.results }}`

4. **Webhook Response**:
   - Respond with: `{{ { "results": $node["Set"].json.results } }}`

#### 3. CORS Configuration for N8N

Ensure your n8n webhook allows CORS requests from your frontend domain. In the webhook node settings, add appropriate CORS headers.

### Direct Integration (Recommended)

For simpler setup, you can call the Express server directly from the frontend without n8n:

```env
VITE_N8N_WEBHOOK_URL=https://your-scraper-backend.onrender.com/search-products
```

### Frontend Integration

The frontend automatically:

1. **Dashboard**: "Find" buttons on low-stock items navigate to Store Locator with the item query
2. **Store Locator**: Automatically searches for products and finds nearby stores carrying them
3. **Google Places**: Locates nearest supermarket chains that stock the searched item

### Environment Variables Required

```env
# Google Maps/Places API
VITE_GOOGLE_PLACES_API_KEY=your_google_api_key

# Product search backend
VITE_N8N_WEBHOOK_URL=https://your-scraper-backend.onrender.com/search-products
```

### Manual Testing

You can test the product search by navigating directly to `/store-locator?query=Milk%201%20kg` or by clicking "Find" on any low-stock item in the Dashboard.

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
