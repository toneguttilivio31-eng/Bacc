# Objectif Bac — IA Puter.js

L'application utilise Puter.js pour les fonctions IA côté navigateur.

- Aucun `GEMINI_API_KEY` ou autre clé IA n'est stocké dans le projet.
- L'IA est appelée depuis `index.html` via `https://js.puter.com/v2/`.
- Modèle principal : `google/gemini-3.6-flash`.
- Au premier appel, l'utilisateur peut être invité à se connecter à Puter.
- `netlify/functions/sync.js` reste utilisé pour la synchronisation.
- `netlify/functions/extract-document.js` reste utilisé pour l'extraction PDF/DOCX.

## Fichiers Netlify

Les anciennes fonctions `ai.js` et `ai-health.js` ne sont plus utilisées et ont été supprimées.
