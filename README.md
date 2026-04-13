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

- API logic (proxy-aware, spec-compliant): `src/services/polyPizzaService.js`
- Three scene: `src/components/ThreeScene.vue`
- Sidebar UI: `src/components/Sidebar.vue`

### Local development

- `npm run dev` configures Vite proxies so browser requests to `/poly-api` and `/poly-static` are transparently forwarded to the official Poly Pizza hosts. This sidesteps the CORS errors shown in the OpenAPI instructions.

### Deployment (Vercel)

- The repo includes two serverless proxies under `api/poly-api/[...path].js` and `api/poly-static/[...path].js`. Deploying on Vercel automatically exposes them at `/api/poly-api/*` and `/api/poly-static/*`, and the frontend calls those endpoints by default in production.
- Set `POLYPIZZA_API_KEY` (or reuse `VITE_POLYPIZZA_API_KEY`) in your Vercel project settings so the serverless proxy can attach the `x-auth-token` header server-side. The browser never talks to `api.poly.pizza` directly, eliminating CORS failures in the hosted version.
