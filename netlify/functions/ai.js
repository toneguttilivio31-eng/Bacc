const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  // Uniquement les requêtes POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée.' })
    };
  }

  try {
    const { prompt, imageBase64, mimeType } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Le paramètre prompt est requis.' })
      };
    }

    // 1. Initialisation avec la clé d'environnement
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // 2. Instanciation du modèle rapide (Gemini Flash)
    const model = genAI.getGenerativeAIModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      }
    });

    // 3. Construction du tableau de contenu selon la spec Google
    const contents = [];

    if (imageBase64 && mimeType) {
      // Structure exacte exigée par la doc pour les images (Base64 + MIME)
      const cleanBase64 = imageBase64.replace(/^data:.*;base64,/, '');
      contents.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType
        }
      });
    }

    // Ajout du prompt textuel
    contents.push(prompt);

    // 4. Exécution de la génération
    const result = await model.generateContent(contents);
    const response = await result.response;
    const textOutput = response.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textOutput })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Erreur Gemini API : ${err.message}` })
    };
  }
};
