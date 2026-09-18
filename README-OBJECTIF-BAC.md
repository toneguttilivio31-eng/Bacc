# Objectif Bac

Version refondue de l’application scolaire Terminale / Bac 2027.

## IA
- L’IA passe par Puter.js dans le navigateur.
- Le catalogue des modèles est chargé avec `puter.ai.listModels()`.
- Aucun `GEMINI_API_KEY`, OpenRouter key ou autre clé IA développeur n’est nécessaire dans Netlify.
- Le modèle peut être choisi dans l’Assistant IA ; pour les photos, l’application privilégie les modèles compatibles image quand leurs capacités sont indiquées.

## Modules
Accueil, Cours, Révisions, Devoirs, Notes, Emploi du temps, Bac 2027, Assistant IA, Coaching, Excellence, Énergie, Objectifs, Parcoursup, Échéances, Erreurs et Notes partagées.

## Cours et photos
Les photos sont conservées avant le traitement IA dans IndexedDB. Plusieurs photos peuvent être ajoutées depuis l’iPhone. Une galerie plein écran permet de les consulter.

La génération est découpée en étapes : transcription, cours complet, résumé/notions, fiches/QCM, ressources. Si une étape échoue, les étapes déjà réussies restent enregistrées et peuvent être relancées.

## Déploiement Netlify
- Publish directory : `.`
- Functions directory : `netlify/functions`
- Aucun build command nécessaire.
