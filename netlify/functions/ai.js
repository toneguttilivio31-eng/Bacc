const { GoogleGenAI } = require('@google/genai');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée.' })
    };
  }

  try {
    const { 
      prompt, 
      imageBase64, 
      mimeType, 
      systemInstruction, 
      jsonMode,
      modelName 
    } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Prompt manquant.' })
      };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const selectedModel = modelName || 'gemini-3.8-flash';

    const defaultInstruction = 
      "Tu es un tuteur pédagogique d'excellence spécialisé dans le Baccalauréat français (Bac 2027). " +
      "Tes objectifs : explications claires et concises, rédaction de fiches de révision structurées, " +
      "résolution d'exercices pas à pas et création de QCM. " +
      "Adopte un ton bienveillant, rigoureux et utilise des formats lisibles (listes à puces, définitions en gras).";

    // Préparation des entrées pour l'API Interactions (Texte / Vision)
    const inputParts = [];

    if (imageBase64 && mimeType) {
      inputParts.push({
        type: 'image',
        data: imageBase64.replace(/^data:.*;base64,/, ''),
        mime_type: mimeType
      });
    }

    inputParts.push(prompt);

    const interactionParams = {
      model: selectedModel,
      input: inputParts.length === 1 ? inputParts[0] : inputParts,
      system_instruction: systemInstruction || defaultInstruction,
    };

    if (jsonMode) {
      interactionParams.response_format = { type: 'json_object' };
    }

    // Appel via l'API Interactions officielle de Google
    const interaction = await ai.interactions.create(interactionParams);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: interaction.output_text })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Erreur API Gemini : ${err.message}` })
    };
  }
};
