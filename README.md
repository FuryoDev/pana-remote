# Pana Remote Control

Pana Remote Control est une interface de supervision pour piloter un parc de caméras Canon PTZ via Companion et un Stream Deck. L'application Vue 3 centralise la configuration des connexions réseau, l'organisation des boutons Companion, la gestion des presets internes aux caméras et le catalogue d'actions disponibles. Un service Express optionnel expose les commandes réseau nécessaires pour dialoguer avec les caméras Panasonic.

## Sommaire
- [Vue d'ensemble fonctionnelle](#vue-densemble-fonctionnelle)
- [Architecture du code](#architecture-du-code)
  - [Entrée et composition des vues](#entrée-et-composition-des-vues)
  - [Composables et état persistant](#composables-et-état-persistant)
  - [Catalogue de données et types partagés](#catalogue-de-données-et-types-partagés)
  - [Composants UI](#composants-ui)
  - [API côté client](#api-côté-client)
  - [Service Express côté serveur](#service-express-côté-serveur)
  - [Scripts et outils](#scripts-et-outils)
- [Flux fonctionnels principaux](#flux-fonctionnels-principaux)
  - [Connexions caméra](#connexions-caméra)
  - [Pages et boutons Companion](#pages-et-boutons-companion)
  - [Gestion des presets caméra](#gestion-des-presets-caméra)
  - [Configuration des actions](#configuration-des-actions)
- [Mise en route pour les développeurs](#mise-en-route-pour-les-développeurs)
  - [Prérequis](#prérequis)
  - [Commandes NPM](#commandes-npm)
  - [Lancer l'API Express](#lancer-lapi-express)
- [Documentation utilisateur](#documentation-utilisateur)
  - [1. Tableau de bord et navigation](#1-tableau-de-bord-et-navigation)
  - [2. Connexions](#2-connexions)
  - [3. Boutons Companion](#3-boutons-companion)
  - [4. Presets caméra](#4-presets-caméra)
  - [5. Actions](#5-actions)

## Vue d'ensemble fonctionnelle
- **Tableau de bord** : l'application s'ouvre sur un shell unique (`App.vue`) qui affiche un résumé du nombre de connexions, de presets et de boutons configurés, avec une navigation par onglets pour accéder aux différentes fonctionnalités.【F:src/App.vue†L12-L86】【F:src/App.vue†L101-L143】
- **Connexions** : inventoriez vos caméras, visualisez leur statut et accédez à un panneau de contrôle en direct pour chaque emplacement physique de la salle (`ConnectionsView.vue`).【F:src/views/ConnectionsView.vue†L1-L119】【F:src/views/ConnectionsView.vue†L121-L189】
- **Boutons** : composez les pages de Stream Deck, assignez un preset ou une action à chaque bouton, prévisualisez les derniers événements Companion et chargez des icônes personnalisées (`ButtonsView.vue`).【F:src/views/ButtonsView.vue†L1-L118】【F:src/views/ButtonsView.vue†L120-L198】
- **Presets** : créez et réorganisez les presets caméra, associez-leur une palette de couleurs et sélectionnez les actions importées qui doivent être rappelées (`PresetManagerView.vue`). Le drag & drop utilise `vue-draggable` pour refléter l'ordre sauvegardé côté store.【F:src/views/PresetManagerView.vue†L1-L87】【F:src/views/PresetManagerView.vue†L89-L166】
- **Actions** : adaptez le catalogue d'actions Companion hérité du projet historique (`ActionConfigView.vue`) afin de renommer, taguer ou changer le type d'entrée recommandé pour chaque action.

Toutes les données manipulées côté client sont persistées dans `localStorage` pour retrouver la configuration d'une session à l'autre. L'intention est ensuite d'exporter ces informations vers Companion ou le backend Express lorsque la synchronisation sera prête.【F:src/composables/usePersistentStorage.ts†L1-L43】

## Architecture du code
### Entrée et composition des vues
- `src/main.ts` monte l'application Vue 3 sur `#app` et charge le style global (`src/style.css`).【F:src/main.ts†L1-L6】
- `src/App.vue` gère la navigation entre les quatre vues principales et synchronise l'onglet actif avec le fragment d'URL pour permettre un partage de liens ou un rafraîchissement sans perdre le contexte.【F:src/App.vue†L22-L57】【F:src/App.vue†L64-L94】
- Les vues sont regroupées dans `src/views/` et suivent un découpage métier : `ConnectionsView.vue`, `ButtonsView.vue`, `PresetManagerView.vue`, `ActionConfigView.vue`. Chacune consomme le store global via `useControlStore` et compose des composants spécialisés.

### Composables et état persistant
- `useControlStore.ts` est un store maison basé sur l'API de composition. Il encapsule l'ensemble des modules métier :
  - connexions (`connections`, `createConnection`, `updateConnection`, etc.) ;
  - presets (`createPreset`, `updatePresetActions`, drag & drop avec `reorderPresets`) ;
  - pages Stream Deck (`deckPages`, `updateDeckButton`, pagination et sélection) ;
  - profils d'action (`configuredActions`, `resetActionProfile`).
  Les valeurs sont sérialisées en `localStorage` via `usePersistentRef` afin de conserver la configuration localement.【F:src/composables/useControlStore.ts†L1-L206】【F:src/composables/useControlStore.ts†L208-L353】
- `usePersistentStorage.ts` fournit un wrapper générique autour de `ref` qui lit/écrit dans `localStorage`, gère les erreurs de parsing et évite les appels côté serveur (en test SSR la fonctionnalité est inactive).【F:src/composables/usePersistentStorage.ts†L1-L43】
- `useControlLayouts.ts` gère la récupération et la persistance des layouts de widgets côté serveur (catalogue de contrôles, positionnement sur une grille, ajout/retrait, réordonnancement). Il est pensé pour la vue d'administration des panneaux de contrôle en direct.【F:src/composables/useControlLayouts.ts†L1-L158】【F:src/composables/useControlLayouts.ts†L160-L218】

### Catalogue de données et types partagés
- `src/data/legacy-actions.generated.ts` contient le catalogue d'actions Companion auto-généré à partir du projet existant (script `scripts/generate-actions.mjs`). Les actions sont regroupées par catégories métier et exposent les types d'entrée supportés.【F:src/data/legacy-actions.generated.ts†L1-L68】
- Les types TypeScript sont centralisés dans `src/types/` (actions, presets, connexions, stream deck, caméra) afin de partager un vocabulaire commun entre les vues, le store et les modules de communication.【F:src/types/actions.ts†L1-L74】【F:src/types/stream-deck.ts†L1-L78】
- `src/shared/control.ts` expose les définitions de widgets partagés entre le frontend et l'API (identifiants, catégories, actions associées) pour garantir la parité des fonctionnalités. Certaines actions sont marquées `planned` pour documenter les fonctionnalités à venir.【F:src/shared/control.ts†L1-L115】【F:src/shared/control.ts†L117-L226】

### Composants UI
- `src/components/` regroupe les panneaux métiers :
  - `CameraPreviewPanel.vue`, `CameraStreamPanel.vue` et `CameraPtzJoystick.vue` construisent le panneau de contrôle en direct ;
  - `CameraStatusPanel.vue` et `useCameraStatus.ts` récupèrent périodiquement l'état matériel via l'API ;
  - `PresetGrid.vue` et `components/draggable/ReorderableGrid.vue` gèrent les listes réordonnables ;
  - `ControlContainer.vue` instancie dynamiquement des widgets en s'appuyant sur le catalogue partagé.
  Ces composants consomment les types définis dans `src/types/` pour garantir l'alignement des props.

### API côté client
- `src/lib/api/controlActions.ts` fournit un helper `executeControlAction` qui encapsule les appels HTTP vers l'API Express en fonction du type d'action (zoom, PTZ, presets, streaming, etc.). Le module uniformise les erreurs et les messages de confirmation à afficher dans l'UI.【F:src/lib/api/controlActions.ts†L1-L42】
- `src/lib/id.ts` et `src/lib/logger.ts` regroupent la génération d'identifiants et la journalisation.

### Service Express côté serveur
- `src/server/server.ts` expose l'API REST permettant d'envoyer des commandes PTZ, zoom, focus, presets et streaming aux caméras Panasonic. Il s'appuie sur `PanasonicCameraService` (module `src/lib/panasonic/`) pour exécuter les requêtes réseau et renvoie des erreurs explicites en cas d'échec.【F:src/server/server.ts†L1-L86】【F:src/server/server.ts†L88-L200】
- Des routes supplémentaires (`/api/control/*`) servent les layouts de widgets et le flux live vidéo via des sous-routeurs dédiés.
- La configuration du port est contrôlée par la variable d'environnement `PORT`, 3000 par défaut.

### Scripts et outils
- `scripts/generate-actions.mjs` régénère le fichier `legacy-actions.generated.ts` à partir des définitions sources Companion si celles-ci évoluent.
- `node_modules/vue-draggable` est embarqué via un vendor local (`src/vendor/vue-draggable.ts`) pour disposer d'un composant de drag & drop compatible avec Vue 3.

## Flux fonctionnels principaux
### Connexions caméra
- Les connexions sont stockées dans `useControlStore` avec un ID unique, les informations réseau (adresse IP, port HTTP, modèle) et des métadonnées (notes, statut, horodatage). Les mises à jour se propagent aux vues via des `computed`. Supprimer une connexion retire automatiquement les bindings de presets associés aux boutons Stream Deck.【F:src/composables/useControlStore.ts†L208-L288】
- `ConnectionsView.vue` présente une grille de dix emplacements physiques avec placeholders préconfigurés ; au-delà, les connexions excédentaires apparaissent paginées. La sélection d'un slot met à jour le formulaire d'édition latéral et alimente le panneau de contrôle.

### Pages et boutons Companion
- Les pages de Stream Deck sont initialisées avec 32 boutons chacune. `useControlStore` garantit qu'une première page est toujours créée et maintient l'indice de tri lorsqu'on renomme ou supprime des pages.【F:src/composables/useControlStore.ts†L104-L206】【F:src/composables/useControlStore.ts†L314-L353】
- `ButtonsView.vue` synchronise l'onglet actif avec le store, expose la navigation page précédente/suivante et déclenche les opérations du store pour ajouter/retirer une page ou mettre à jour un bouton (mode texte, icône PNG, bindings press/release).【F:src/views/ButtonsView.vue†L1-L198】【F:src/views/ButtonsView.vue†L200-L271】
- Le store conserve un historique des derniers événements Companion (`deckEvents`) limité aux 50 dernières entrées pour faciliter le diagnostic lors des tests UI.【F:src/composables/useControlStore.ts†L353-L404】

### Gestion des presets caméra
- Les presets sont créés à partir d'un formulaire minimal (nom, description, couleur) et liés à une liste d'actions. Lorsqu'un preset est supprimé, le store nettoie automatiquement les boutons qui pointaient vers ce preset pour éviter les références orphelines.【F:src/composables/useControlStore.ts†L206-L270】
- `PresetManagerView.vue` applique `vue-draggable` pour réordonner les presets. La sélection d'une action l'ajoute à la liste des bindings avec un type d'entrée par défaut basé sur la définition de l'action.【F:src/views/PresetManagerView.vue†L1-L166】

### Configuration des actions
- `configuredActions` combine le catalogue `LEGACY_ACTIONS` et les personnalisations utilisateur (libellé, tags, input par défaut). Les actions sont triées alphabétiquement en français pour offrir un repère stable dans toutes les vues.【F:src/composables/useControlStore.ts†L66-L103】
- `ActionConfigView.vue` (non détaillé ici) permet d'ajuster ces profils, ce qui impacte instantanément les presets et les boutons qui consomment la même action.

## Mise en route pour les développeurs
### Prérequis
- Node.js 18+ (compatible avec Vite 7 et TypeScript 5.9).
- npm 9+ ou équivalent (pnpm/yarn) pour gérer les dépendances.
- Accès réseau aux caméras Panasonic si vous utilisez l'API Express.

### Commandes NPM
```bash
npm install          # installe les dépendances front et back
npm run dev          # lance Vite en mode développement (http://localhost:5173)
npm run build        # vérifie les types puis génère les assets de production
npm run preview      # prévisualise le build statique
```

### Lancer l'API Express
L'API Express n'est pas lancée automatiquement par Vite. Pour la tester en local :
```bash
node --loader ts-node/esm src/server/server.ts
```
Configurez vos variables d'environnement (`.env`) pour renseigner les identifiants des caméras si nécessaire. Les endpoints principaux sont détaillés dans `src/server/server.ts`.

## Documentation utilisateur
### 1. Tableau de bord et navigation
- Utilisez la barre d'onglets en haut pour accéder aux sections **Connections**, **Buttons**, **Presets** et **Actions**.
- Les indicateurs de synthèse vous donnent en un coup d'œil le nombre de connexions actives, de pages Stream Deck, de presets et de boutons configurés.

### 2. Connexions
1. Cliquez sur un emplacement libre dans la grille pour préparer l'ajout d'une caméra.
2. Renseignez le nom, l'adresse IP, le port HTTP et le modèle. Activez l'option *Auto-connect* si la caméra doit être connectée dès l'ouverture de Companion.
3. Ajoutez des notes techniques pour l'équipe de régie.
4. Utilisez le panneau de contrôle (PTZ, zoom, presets) pour valider que la caméra répond. Les boutons déclenchent les actions exposées par l'API Express.
5. Supprimez une connexion depuis la barre latérale si la caméra est déplacée ; les boutons Stream Deck liés seront nettoyés automatiquement.

### 3. Boutons Companion
1. Sélectionnez une page via le sélecteur supérieur ou utilisez les flèches précédente/suivante.
2. Renommez la page dans le formulaire latéral pour refléter son usage (ex. « Culte – Scènes 1-32 ») puis enregistrez.
3. Cliquez sur un bouton pour l'éditer :
   - choisissez le mode d'affichage (texte ou icône) ;
   - saisissez le texte ou importez une icône PNG 144×144 ;
   - affectez une action (catalogue) ou un preset (liste des presets).
4. Configurez séparément les actions *Appui* et *Relâchement* pour déclencher deux comportements différents.
5. Ajoutez ou supprimez des pages avec les boutons dédiés ; le store limite à 99 pages pour rester compatible avec Companion.【F:src/composables/useControlStore.ts†L90-L104】

### 4. Presets caméra
1. Dans le panneau gauche, complétez le formulaire pour créer un nouveau preset (nom, description, couleur). Il apparaît immédiatement dans la liste.
2. Réordonnez les presets par glisser-déposer pour refléter l'ordre de rappel souhaité sur le Stream Deck.
3. Sélectionnez un preset pour voir ses actions assignées : cochez/décochez les actions disponibles ou modifiez le type d'entrée (bouton, potentiomètre, etc.).
4. Ajoutez des notes sur chaque binding pour aider les opérateurs à comprendre le contexte.
5. Supprimez un preset si nécessaire ; tous les boutons qui le ciblaient seront réinitialisés.

### 5. Actions
1. Parcourez le catalogue pour identifier les actions importées depuis le projet historique.
2. Personnalisez le libellé, la description, les tags et le type d'entrée par défaut pour harmoniser le vocabulaire avec votre équipe.
3. Les actions marquées « planned » servent de rappel pour les fonctionnalités à développer : laissez-les en place pour garder la visibilité sur la roadmap.

> 💡 Astuce : toute la configuration est enregistrée dans le navigateur. Pensez à exporter/importer les données (fonctionnalité à venir) ou à synchroniser avec Companion avant de changer de poste.
