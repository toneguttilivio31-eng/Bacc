const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  }

  try {
    const { prompt, images, task, youtubeUrl } = JSON.parse(event.body || '{}');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // 1. GESTION DES LIENS YOUTUBE
    if (youtubeUrl) {
      const videoIdMatch = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : null;
      
      const ytPrompt = `Analyse le sujet de cette vidéo YouTube (ID: ${videoId || 'inconnu'}) ou du lien fourni (${youtubeUrl}) avec ce contexte : "${prompt}". 
      Fais-en une fiche de cours structurée complète avec résumé, points clés et 3 questions de révision.`;

      const result = await model.generateContent(ytPrompt);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, result: result.response.text() })
      };
    }

    // 2. PIPELINE COMPLETE (COURS + RESUME + FLASHCARDS + QCM) EN UNE SEULE PASSE
    if (task === 'complete_pipeline') {
      const pipelinePrompt = `Tu es l'expert pédagogique numéro 1 du Baccalauréat Français.
Analyse les documents/images/textes fournis et génère une réponse STRICTEMENT au format JSON valide suivant, sans texte autour :

{
  "summary": "Résumé fluide, parfaitement rédigé et structuré en français impeccable avec émojis et bullet points (300 mots max).",
  "fullCourse": "Cours complet et approfondi (niveau Terminale/Première) rédigé avec rigueur, titres, définitions, dates clés et problématiques (800-1200 mots).",
  "flashcards": [
    {"q": "Question flashcard 1", "a": "Réponse claire et concise 1"},
    {"q": "Question flashcard 2", "a": "Réponse claire et concise 2"},
    {"q": "Question flashcard 3", "a": "Réponse claire et concise 3"},
    {"q": "Question flashcard 4", "a": "Réponse claire et concise 4"}
  ],
  "quiz": [
    {
      "question": "Question QCM 1",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 0,
      "explanation": "Explication rapide de la bonne réponse."
    },
    {
      "question": "Question QCM 2",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": 1,
      "explanation": "Explication rapide."
    }
  ]
}

Source / Contenu à traiter :
${prompt || 'Analyse complète des images fournies.'}`;

      const contents = [pipelinePrompt];
      if (images && images.length > 0) {
        images.forEach(imgBase64 => {
          const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, '');
          contents.push({
            inlineData: { mimeType: 'image/jpeg', data: cleanBase64 }
          });
        });
      }

      const result = await model.generateContent(contents);
      let textResponse = result.response.text().trim();
      textResponse = textResponse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data: JSON.parse(textResponse) })
      };
    }

    // 3. REQUÊTE STANDARD (CHAT / DEVOIRS)
    const contents = [prompt || 'Analyse l\'image.'];
    if (images && images.length > 0) {
      images.forEach(imgBase64 => {
        const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, '');
        contents.push({
          inlineData: { mimeType: 'image/jpeg', data: cleanBase64 }
        });
      });
    }

    const result = await model.generateContent(contents);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, result: result.response.text() })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: `Erreur IA : ${err.message}` })
    };
  }
};
