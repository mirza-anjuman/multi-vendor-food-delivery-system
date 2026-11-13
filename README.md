# Multi-Vendor Food Delivery System

React + TypeScript frontend with a Node.js/Express backend, MongoDB, JWT
authentication, Socket.IO, and optional OSRM routing.

## Requirements

- Node.js and npm (or pnpm)
- MongoDB running locally or a MongoDB connection string
- Docker Desktop is optional for OSRM road routing

## Installation

From the repository root:

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

The repository also includes pnpm lockfiles if you use pnpm instead.

## Environment

Create the backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

For local development, set valid values for:

```env
MONGODB_URI=mongodb://localhost:27017/food-delivery
JWT_ACCESS_SECRET=at-least-32-characters
JWT_REFRESH_SECRET=at-least-32-characters
UNSUBSCRIBE_JWT_SECRET=at-least-32-characters
EMAIL_PAYLOAD_SECRET=at-least-32-characters
DELIVERY_QUOTE_SECRET=at-least-32-characters
FRONTEND_URL=http://localhost:5173
EMAIL_MODE=sandbox
```

`EMAIL_MODE=sandbox` avoids SMTP configuration and writes email previews locally.
Cloudinary variables are only needed for Cloudinary uploads.

Optional frontend variables can be placed in `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:2002
VITE_OSRM_URL=http://localhost:5000
VITE_OSM_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
```

The frontend uses the API and OSM tile defaults when these variables are not set.

## Run locally

Make sure MongoDB is running, then start both applications:

```powershell
npm run dev
```

Or run them separately:

```powershell
npm run dev:backend
npm run dev:frontend
```

The default URLs are:

- Frontend: <http://localhost:5173>
- Backend: <http://localhost:2002>
- Health check: <http://localhost:2002/health>

## Seed the database

```powershell
npm run db:seed
```

The seed command clears the database before inserting fixtures. If the MongoDB
user cannot run `dropDatabase` (for example, a restricted Atlas user), it
automatically clears each collection instead. Existing non-empty restaurant
images in `backend/uploads/restaurants/` are reused rather than downloaded
again.

## Optional OSRM routing

Without OSRM, the backend uses its distance fallback. To enable local road
routing, prepare the Bangladesh map data and start the Docker service:

```bash
./scripts/setup-osrm.sh
docker compose -f docker-compose.delivery.yml up -d
```

Run the setup script from Git Bash or WSL. OSRM listens on
<http://localhost:5000>. Docker Desktop and the generated `data\osrm` files
are required for this option.

## Validation

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build

cd ..\backend
npm run type-check
npm test
```
