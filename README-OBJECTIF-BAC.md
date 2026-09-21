# Objectif Bac

Application web de pilotage de Terminale pour Livio et Lorette.

## IA

L’IA est intégrée dans le navigateur avec Puter.js (`https://js.puter.com/v2/`). Aucune clé Gemini, OpenRouter ou autre clé API IA n’est nécessaire dans Netlify ou GitHub. Le modèle utilisé par défaut est `google/gemini-3.6-flash`.

Au premier appel IA, Puter peut demander à l’utilisateur de se connecter à son compte Puter.

## Fonctions Netlify conservées

- `netlify/functions/sync.js` : synchronisation des données entre appareils.
- `netlify/functions/extract-document.js` : extraction de texte depuis PDF/DOCX.

Les anciennes fonctions IA `ai.js` et `ai-health.js` ont été supprimées.
