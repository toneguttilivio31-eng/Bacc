# Objectif Bac

Application web de pilotage de Terminale pour Lorette.

## IA Gemini

L’application utilise le SDK officiel Google `@google/genai` côté serveur et l’API Interactions Gemini via `netlify/functions/ai.js`. La clé n’est jamais exposée dans le navigateur.

Variable Netlify obligatoire :

`GEMINI_API_KEY`

Ne jamais mettre cette clé dans `index.html` ou dans GitHub.

## Modules conservés

- Accueil / tableau de bord
- Emploi du temps et calendrier
- Cours et chapitres
- Révisions
- Devoirs
- Notes
- Bac 2027
- Assistant IA
- Coaching
- Excellence
- Énergie

## IA dans l’application

- assistant conversationnel
- contexte de conversation avec `previous_interaction_id`
- analyse de photos et documents
- résumé et cours
- questions de révision
- QCM et flashcards
- aide et correction des devoirs
- sorties structurées JSON pour les contenus qui en ont besoin
- Google Search lorsque demandé
- function calling limité aux fonctions serveur Objectif Bac autorisées
- streaming et tâches longues via Interactions
- génération d’images via le modèle Gemini image lorsque la fonction est appelée

## Fichiers Netlify

- `netlify/functions/ai.js` : moteur Gemini sécurisé
- `netlify/functions/sync.js` : synchronisation des données
- `netlify/functions/extract-document.js` : extraction PDF/DOCX/TXT/MD

## Déploiement

Le dossier `netlify/functions` doit rester exactement à cet emplacement.

Netlify utilise :

- Publish directory : `.`
- Functions directory : `netlify/functions`

Après modification de la variable `GEMINI_API_KEY`, effectuer un nouveau déploiement pour que la Function récupère la nouvelle configuration.
