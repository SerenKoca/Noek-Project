# Noek PoC

Minimal Vue 3 + Three.js + Tailwind PoC that fetches models from Poly Pizza (per the provided OpenAPI YAML) and loads GLB/GLTF into a bounded 10x10 room.

## Setup

1) Create `.env` (see `.env.example`) with at least:

```
VITE_POLYPIZZA_API_KEY=your_key_here
POLYPIZZA_API_KEY=your_key_here # used by the Vercel proxy
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
```

Optional overrides if you expose your own proxy endpoints:

```
# VITE_POLYPIZZA_API_BASE_URL=https://your-proxy/v1.1
# VITE_POLYPIZZA_STATIC_BASE_URL=https://your-proxy/static
```

2) Install + run:

- `npm install`
- `npm run dev`

## Implementation notes


### Local development


## Template editor & marker size

- Each template slot can include a `markerSize` numeric property (scale factor, `1` = default). This controls the visual size of the placement point in the scene.
- To edit a slot's marker size in the app: open the Template Editor (admin/editor), pick a slot and change `Puntgrootte` (point size). Click `Toepassen` and then save the template from the Admin page to persist to the database.
- You can also update the template from a JSON file using the backend helper:

```bash
cd backend
# update from backend/scripts/sample-scene.json (or another JSON file)
npm run seed:template
```

Or run the script directly:

```bash
node backend/scripts/updateTemplate.js path/to/sceneData.json your_template_owner_email@example.com
```

Ensure `MONGO_URI` is configured and the template owner user exists (by default `admin@admin.be` in `backend/.env`).

### Deployment (Vercel)
- Set `POLYPIZZA_API_KEY` (or reuse `VITE_POLYPIZZA_API_KEY`) in your Vercel project settings so the serverless proxy can attach the `x-auth-token` header server-side. The browser never talks to `api.poly.pizza` directly, eliminating CORS failures in the hosted version.
