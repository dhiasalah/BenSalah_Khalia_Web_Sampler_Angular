# Web Audio Sampler – Angular App

This Angular application is the frontend for the Web Audio Sampler project.

## Features

- Dynamic preset menu with categories (drumkit, piano, etc.)
- Loads presets from a backend REST API
- Headless audio engine (logic separated from UI)
- Automated headless test mode

## Core Logic

- Uses an `AudioEngine` service for all audio processing
- Communicates with the backend for preset management
- GUI components for pad grid, preset menu, and more

## Technologies

- Angular 17+
- TypeScript
- RxJS
- REST API integration

See [ARCHITECTURE.md](./ARCHITECTURE.md) for more details.

```bash

```
