# Objectif Bac — Gemini API (JavaScript / Netlify)

Cette version utilise le SDK officiel Google `@google/genai` et l'API Interactions.

## Netlify

Créer une variable d'environnement :

`GEMINI_API_KEY`

Ne jamais mettre la clé dans `index.html` ou dans GitHub.

## Modèles

- `gemini-3.8-flash` : moteur principal
- `gemini-3.5-flash-lite` : secours
- `gemini-3.1-flash-lite` : secours léger
- `gemini-3.1-flash-image` : génération d'image
- `gemini-3.1-flash-lite-image` : secours image

## Fonctionnalités intégrées dans la fonction Netlify

- génération de texte
- conversations avec `previous_interaction_id`
- mode sans état via `store: false` quand demandé
- entrées multimodales : image, audio, vidéo et document (données base64 ou URI)
- sorties JSON structurées avec `responseSchema`
- Google Search
- URL Context, Code Execution et File Search en outils explicitement autorisés
- function calling avec une boucle serveur limitée à des fonctions Objectif Bac déterministes
- streaming (collecte des événements Interactions)
- tâches en arrière-plan + endpoint de polling
- génération d'images
- agents gérés autorisés explicitement et exécutés dans l'environnement distant Google
- citations de recherche renvoyées à l'interface

## Sécurité

Le navigateur appelle `/.netlify/functions/ai`. La clé Gemini reste dans les variables d'environnement Netlify.

## Installation locale

`npm install`

Le SDK officiel JavaScript est `@google/genai`.
