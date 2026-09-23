const pdf = require('pdf-parse');
const mammoth = require('mammoth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée.' }) };
  }

  try {
    const { fileData, fileType } = JSON.parse(event.body || '{}');
    if (!fileData || !fileType) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Fichier ou format manquant.' }) };
    }

    const buffer = Buffer.from(fileData.replace(/^data:.*;base64,/, ''), 'base64');
    let extractedText = '';

    if (fileType.includes('pdf')) {
      const data = await pdf(buffer);
      extractedText = data.text;
    } else if (fileType.includes('word') || fileType.includes('docx')) {
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Format non pris en charge (PDF et DOCX uniquement).' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: extractedText, success: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: `Erreur d'extraction : ${err.message}` })
    };
  }
};
