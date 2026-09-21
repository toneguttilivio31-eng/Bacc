# Objectif Bac

Application web de pilotage de Terminale pour Livio et Lorette. Fichier unique (`index.html`), déployée sur Netlify.

## IA — Google Gemini (API Interactions)

L'IA passe par la fonction serveur `netlify/functions/ai.js`, qui utilise le SDK officiel `@google/genai`
et l'API Interactions de Google (bêta). Le navigateur n'a jamais accès à la clé API : il appelle
`/.netlify/functions/ai`, qui appelle Gemini côté serveur.

**Configuration requise sur Netlify** (Site configuration → Environment variables) :

```
GEMINI_API_KEY = <ta clé Gemini, depuis https://aistudio.google.com/apikey>
```

Ne mets jamais cette clé dans `index.html` ni dans GitHub.

Modèles utilisés (dans l'ordre de repli si l'un échoue) : `gemini-3.8-flash`, `gemini-3.5-flash-lite`,
`gemini-3.1-flash-lite`. Génération d'images : `gemini-3.1-flash-image`.

Fonctionnalités exposées par `ai.js` : génération de texte, conversations avec état
(`previous_interaction_id`) et sans état, entrée multimodale (image/audio/vidéo/document),
sortie structurée JSON, Google Search / URL Context / Code Execution / File Search, appel de
fonction limité aux fonctions internes déterministes d'Objectif Bac, streaming, exécution en
arrière-plan avec polling, génération d'images, agents gérés (sur demande explicite uniquement).

## Fonctions Netlify

- `netlify/functions/ai.js` : toutes les requêtes IA (Assistant, Cours, Devoirs, corrections, révisions).
- `netlify/functions/sync.js` : synchronisation des données entre les appareils de Livio et Lorette (Netlify Blobs).
- `netlify/functions/extract-document.js` : extraction de texte depuis des PDF/DOCX envoyés en pièce jointe.

## Installation / déploiement

Le projet est Node.js. `npm install` installe les dépendances (`pdfjs-dist`, `mammoth`,
`@netlify/blobs`, `@google/genai`). Netlify installe ces dépendances automatiquement au build.
`netlify.toml` configure le dossier `netlify/functions` et le bundler `esbuild`.
