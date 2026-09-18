# Puter.js — Objectif Bac

Le site utilise Puter.js côté navigateur :

```html
<script src="https://js.puter.com/v2/"></script>
```

Le catalogue est découvert automatiquement avec `puter.ai.listModels()` et l’appel IA se fait avec `puter.ai.chat()`.

Il n’y a volontairement aucune clé API IA à mettre dans Netlify. Si Puter demande une connexion/autorisation, elle se fait côté utilisateur.

Les images sont stockées localement dans IndexedDB et les conversations IA y sont également sauvegardées, avec un secours dans le stockage local lorsque celui-ci est disponible.
