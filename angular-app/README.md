# AngularApp - Web Audio Sampler

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.0.

## 🎯 Features

- **Dynamic Preset Menu**: Fetches presets from backend via REST API
- **Category Organization**: Presets grouped by type (Drumkit, Piano, etc.)
- **Headless Audio Engine**: Core audio engine completely separated from GUI
- **Automated Testing**: Headless test mode for testing without user interaction

## 🏗️ Architecture

This application demonstrates **proper separation between GUI and audio engine**:

- **AudioEngine Service** (`src/app/services/audio-engine.ts`): Core audio processing, works independently
- **HeadlessTest Component** (`src/app/components/headless-test/`): Automated testing without GUI
- **PresetService** (`src/app/services/preset.ts`): API communication with backend
- **PresetMenu Component** (`src/app/components/preset-menu/`): GUI for preset selection

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

**Important**: Make sure the backend is running on port 5000:

```bash
cd ../backend
npm start
```

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
