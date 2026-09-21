/* Objectif Bac — Gemini health check. No API key is returned. */
exports.handler = async event => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: {'content-type':'application/json'}, body: JSON.stringify({ok:false,error:'Méthode non autorisée.'}) };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { statusCode: 500, headers: {'content-type':'application/json'}, body: JSON.stringify({ok:false,configured:false,error:'GEMINI_API_KEY n’est pas configurée dans Netlify.'}) };
  }
  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return { statusCode: 200, headers: {'content-type':'application/json','cache-control':'no-store'}, body: JSON.stringify({ok:true,configured:true,sdk:'@google/genai',api:'Interactions',model:'gemini-3.8-flash'}) };
  } catch (error) {
    return { statusCode: 500, headers: {'content-type':'application/json'}, body: JSON.stringify({ok:false,configured:true,error:'Le SDK Gemini n’a pas pu être chargé.',details:String(error?.message||error)}) };
  }
};
