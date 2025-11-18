# Web Audio Sampler - Backend Server

REST API server for the Web Audio Sampler application. Provides endpoints for managing audio presets and samples.

## Prerequisites

- Node.js 16+
- npm or yarn

## Setup & Installation

```bash
# Install dependencies
npm install
```

## Running the Server

```bash
# Start the server (runs on port 5000)
npm start
```

The server will be available at `http://localhost:5000`

## API Endpoints

- `GET /api/presets` - Get all available presets
- `GET /api/presets/:name` - Get a specific preset
- `GET /presets/*` - Serve preset files
- `GET /sounds/*` - Serve sound files

## Testing

```bash
# Run unit tests
npm run tests
```

## Technologies

- Node.js
- Express.js
- Multer (file uploads)
- ES6 Modules

## GitHub Actions

CI/CD workflow configured in `.github/workflows/ci.yml` for automated testing on push and pull requests.
