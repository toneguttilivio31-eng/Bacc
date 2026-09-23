const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  }

  try {
    const { prompt, imageBase64, mimeType } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Prompt manquant.' }) };
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Initialisation avec réglages haute vitesse
    const model = genAI.getGenerativeAIModel({
      model: 'gemini-3.8-flash',
      generationConfig: {
        temperature: 0.4,       // Vitesse & précision (réduit les hésitations)
        topP: 0.8,              // Filtre les choix secondaires pour générer plus vite
        topK: 40,               // Restreint le dictionnaire de recherche
        maxOutputTokens: 2048,  // Évite les réponses inutilement longues
      }
    });

    let response;

    // Traitement Multimodal (Photo de cours) ou Texte simple
    if (imageBase64 && mimeType) {
      const imagePart = {
        inlineData: {
          data: imageBase64.replace(/^data:.*;base64,/, ''),
          mimeType: mimeType
        }
      };
      response = await model.generateContent([prompt, imagePart]);
    } else {
      response = await model.generateContent(prompt);
    }

    const textOutput = response.response.text();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textOutput })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Erreur API Gemini : ${err.message}` })
    };
  }
};
