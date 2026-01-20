# Architecture: Séparation GUI et Moteur Audio

## Vue d'ensemble

L'application Angular suit une architecture qui **sépare complètement le moteur audio de l'interface graphique (GUI)**. Cela permet au moteur audio de fonctionner de manière autonome, sans aucune dépendance à l'interface utilisateur.

## Structure des Composants

### 1. Moteur Audio (Headless) 🎵

**Fichier**: `src/app/services/audio-engine.ts`

Le moteur audio est un service Angular complètement **indépendant de la GUI**:

- ✅ Peut fonctionner sans aucune interface utilisateur
- ✅ Gère le Web Audio API (AudioContext, AudioBuffer, etc.)
- ✅ Charge les échantillons audio depuis des URLs
- ✅ Joue les sons sur les pads (0-15)
- ✅ Gère les points de trim (découpage)
- ✅ Contrôle le gain (volume) par pad

**Principales méthodes**:

```typescript
// Initialisation
await audioEngine.initialize();

// Chargement d'un sample
await audioEngine.loadSoundFromURL(padIndex, url, progressCallback);

// Lecture d'un pad
audioEngine.play(padIndex);

// Configuration du trim
audioEngine.setTrimPoints(padIndex, startTime, endTime);

// Gestion du gain
audioEngine.setGain(padIndex, gainValue);
```

### 2. Test en Mode Headless 🤖

**Fichier**: `src/app/components/headless-test/`

Ce composant démontre que le moteur audio fonctionne **sans interaction GUI**:

- 📡 Récupère automatiquement les presets depuis le backend
- 📥 Charge les samples de manière programmatique
- 🎼 Joue des patterns rythmiques automatiquement
- 📊 Affiche les logs en temps réel
- ✅ Exécute tous les tests sans cliquer sur l'interface

**Test automatique complet**:

1. Initialise le moteur audio
2. Récupère les presets via API (`GET /api/presets`)
3. Charge automatiquement 8 samples dans les pads
4. Joue chaque sample en séquence
5. Teste la fonctionnalité de trim
6. Affiche les résultats

### 3. Service de Presets 📡

**Fichier**: `src/app/services/preset.ts`

Service pour communiquer avec le backend:

```typescript
// Récupérer tous les presets
getPresets(): Observable<Preset[]>

// Récupérer un preset spécifique
getPreset(name: string): Observable<Preset>

// Récupérer les presets par catégorie
getPresetsGroupedByCategory(): Observable<PresetsByCategory>
```

### 4. Menu des Presets (GUI) 📋

**Fichier**: `src/app/components/preset-menu/`

Interface graphique pour sélectionner les presets:

- 📁 Vue par catégories (Drumkit, Piano, etc.)
- 📋 Vue en liste plate
- 🔄 Bouton de rafraîchissement
- ✨ Affichage du nombre de samples

## Flux de Données

```
Backend API (Node.js)
    ↓
PresetService (Angular)
    ↓
┌─────────────────────┬──────────────────────┐
│                     │                      │
│  HeadlessTest       │   PresetMenu (GUI)   │
│  (Mode automatique) │   (Mode manuel)      │
│                     │                      │
└─────────┬───────────┴──────────┬───────────┘
          │                      │
          └──────────┬───────────┘
                     ↓
              AudioEngine (Service)
                     ↓
              Web Audio API
                     ↓
                🔊 Sortie Audio
```

## Avantages de cette Architecture

### ✅ Séparation des Responsabilités

- Le moteur audio ne connaît pas la GUI
- La GUI ne connaît pas les détails de l'implémentation audio
- Communication via interfaces claires

### ✅ Testabilité

- Tests unitaires possibles sans GUI
- Tests d'intégration automatisés
- Démonstration en mode headless

### ✅ Réutilisabilité

- Le moteur audio peut être utilisé dans d'autres projets
- Différentes GUI peuvent utiliser le même moteur
- Facile à intégrer dans des tests automatisés

### ✅ Maintenabilité

- Modifications de la GUI sans toucher au moteur
- Optimisations audio sans modifier l'interface
- Code plus organisé et modulaire

## Utilisation

### Mode Headless (Sans GUI)

```typescript
// Dans votre code TypeScript
const engine = inject(AudioEngine);

// Initialiser
await engine.initialize();

// Charger des sons
await engine.loadSoundFromURL(0, 'http://localhost:5000/presets/808/kick.wav');
await engine.loadSoundFromURL(1, 'http://localhost:5000/presets/808/snare.wav');

// Jouer un pattern
engine.play(0); // Kick
await delay(250);
engine.play(1); // Snare
await delay(250);
engine.play(0); // Kick
```

### Mode GUI

L'utilisateur interagit avec:

1. Le menu de presets pour sélectionner un kit
2. Les pads pour déclencher les sons
3. Les contrôles de trim/gain pour modifier les samples

## API Backend Requise

Le système s'attend à ce que le backend expose:

- `GET /api/presets` - Liste tous les presets avec leurs samples
- `GET /api/presets/:name` - Détails d'un preset spécifique
- Les fichiers audio accessibles via `/presets/{preset-name}/{file.wav}`

## Technologies Utilisées

- **Angular 21+** - Framework
- **RxJS** - Gestion de l'asynchrone
- **Web Audio API** - Traitement audio natif
- **TypeScript** - Type safety
- **Signals** - Réactivité moderne d'Angular

## Démonstration

1. Lancer le backend: `cd backend && npm start`
2. Lancer Angular: `cd angular-app && ng serve`
3. Ouvrir http://localhost:4200
4. Cliquer sur "Run Full Headless Test" pour voir le moteur audio fonctionner sans GUI!
