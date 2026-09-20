/* Objectif Bac — Gemini API, official @google/genai SDK + Interactions API.
 * The browser never receives GEMINI_API_KEY.
 *
 * Implemented from Google's current Interactions documentation:
 * - text generation
 * - stateful multi-turn interactions
 * - stateless input/history when explicitly requested
 * - multimodal input (image/audio/video/document data or URI)
 * - structured JSON output
 * - Google Search / URL Context / Code Execution / File Search tool passthrough
 * - safe app function calling loop
 * - streaming collection
 * - background interactions + polling
 * - image generation
 * - managed-agent passthrough (explicitly requested only)
 */

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite'
];
const IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];
const ALLOWED_TOOLS = new Set([
  'google_search',
  'url_context',
  'code_execution',
  'file_search'
]);
const ALLOWED_AGENTS = new Set([
  'antigravity-preview-09-2026',
  'deep-research-preview-04-2026',
  'deep-research-max-preview-04-2026'
]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function cleanText(value) {
  return String(value || '')
    .replace(/^\s*```(?:json|markdown|md|text|txt)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  try {
    const copy = JSON.parse(JSON.stringify(schema));
    return JSON.stringify(copy).length <= 100000 ? copy : null;
  } catch {
    return null;
  }
}

function normalizeContentItem(item) {
  if (!item || typeof item !== 'object') return null;
  const type = String(item.type || '').toLowerCase();
  if (!['image', 'audio', 'video', 'document'].includes(type)) return null;

  const out = { type };
  if (item.data) {
    const data = String(item.data);
    if (data.length > 8000000) return null;
    out.data = data;
    out.mime_type = String(item.mime_type || item.mimeType || defaultMime(type));
  } else if (item.uri) {
    out.uri = String(item.uri);
    if (item.mime_type || item.mimeType) out.mime_type = String(item.mime_type || item.mimeType);
  } else {
    return null;
  }
  return out;
}

function defaultMime(type) {
  return ({
    image: 'image/jpeg',
    audio: 'audio/mpeg',
    video: 'video/mp4',
    document: 'application/pdf'
  })[type] || 'application/octet-stream';
}

function normalizeMedia(body) {
  const input = [];
  const media = Array.isArray(body.media) ? body.media : [];
  const images = Array.isArray(body.images) ? body.images : [];
  for (const item of [...media, ...images.map(im => ({
    type: 'image',
    data: im?.data,
    mime_type: im?.type || im?.mime_type
  }))]) {
    const normalized = normalizeContentItem(item);
    if (normalized) input.push(normalized);
    if (input.length >= 12) break;
  }
  return input;
}

function buildInput(body) {
  if (body.input !== undefined) return body.input;
  const content = [];
  const prompt = String(body.prompt || '').trim();
  if (prompt) content.push({ type: 'text', text: prompt });
  content.push(...normalizeMedia(body));
  if (!content.length) return 'Réponds à la demande de l’élève.';
  return content.length === 1 && content[0].type === 'text' ? content[0].text : content;
}

function normalizeTools(body) {
  const tools = [];
  if (body.googleSearch === true) tools.push({ type: 'google_search' });
  if (Array.isArray(body.tools)) {
    for (const tool of body.tools.slice(0, 8)) {
      if (!tool || typeof tool !== 'object') continue;
      if (ALLOWED_TOOLS.has(String(tool.type))) tools.push(tool);
    }
  }
  // De-duplicate by JSON representation.
  return [...new Map(tools.map(t => [JSON.stringify(t), t])).values()];
}

function extractText(interaction) {
  if (!interaction) return '';
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return cleanText(interaction.output_text);
  }
  const steps = Array.isArray(interaction.steps) ? interaction.steps : [];
  return cleanText(steps
    .filter(step => step?.type === 'model_output')
    .flatMap(step => Array.isArray(step.content) ? step.content : [])
    .filter(block => block?.type === 'text')
    .map(block => block.text || '')
    .join(''));
}

function extractCitations(interaction) {
  const citations = [];
  for (const step of (interaction?.steps || [])) {
    if (step?.type !== 'model_output') continue;
    for (const block of (step.content || [])) {
      for (const a of (block?.annotations || [])) {
        if (a?.type === 'url_citation' && a.url) {
          citations.push({
            url: a.url,
            title: a.title || a.url,
            startIndex: a.start_index,
            endIndex: a.end_index
          });
        }
      }
    }
  }
  return citations;
}

function extractMediaOutput(interaction) {
  return {
    image: interaction?.output_image?.data ? {
      data: interaction.output_image.data,
      mime_type: interaction.output_image.mime_type || 'image/png'
    } : null,
    audio: interaction?.output_audio?.data ? {
      data: interaction.output_audio.data,
      mime_type: interaction.output_audio.mime_type || 'audio/wav'
    } : null
  };
}

function stepSummary(steps) {
  return (Array.isArray(steps) ? steps : []).map(step => ({
    id: step?.id || null,
    type: step?.type || null,
    name: step?.name || null,
    call_id: step?.call_id || null
  }));
}

function appFunctionDefinitions(body) {
  // These are intentionally small, deterministic functions. The browser may ask
  // Gemini to use them, but it cannot execute arbitrary server-side JavaScript.
  const defs = [
    {
      type: 'function',
      name: 'get_current_date',
      description: 'Returns the current date and time in Europe/Paris.',
      parameters: { type: 'object', properties: {} }
    },
    {
      type: 'function',
      name: 'get_objectif_bac_subjects',
      description: 'Returns the school subjects configured in Objectif Bac.',
      parameters: { type: 'object', properties: {} }
    }
  ];
  if (body.enableAppFunctions !== false) return defs;
  return [];
}

function executeAppFunction(name, args, body) {
  if (name === 'get_current_date') {
    return {
      iso: new Date().toISOString(),
      timezone: 'Europe/Paris'
    };
  }
  if (name === 'get_objectif_bac_subjects') {
    return {
      subjects: body.appSubjects || [
        'HGGSP (Spécialité)', 'SES (Spécialité)', 'Histoire-Géographie',
        'Philosophie', 'Anglais', 'Espagnol', 'Maths', 'SVT',
        'Physique-Chimie', 'EMC', 'EPS'
      ]
    };
  }
  throw new Error(`Fonction non autorisée : ${name}`);
}

async function executeFunctionLoop(client, interaction, request) {
  let current = interaction;
  let previousId = interaction?.id || null;
  const tools = request.tools || [];
  const appTools = request.appTools || [];
  const allTools = [...tools, ...appTools];

  for (let round = 0; round < 5; round++) {
    const calls = (current?.steps || []).filter(step => step?.type === 'function_call');
    if (!calls.length) return current;

    const results = [];
    for (const call of calls) {
      const name = String(call.name || '');
      const args = call.arguments && typeof call.arguments === 'object' ? call.arguments : {};
      if (!appTools.some(tool => tool.name === name)) {
        throw Object.assign(new Error(`Gemini a demandé une fonction non autorisée : ${name}`), { status: 400 });
      }
      const result = executeAppFunction(name, args, request.body);
      results.push({
        type: 'function_result',
        name,
        call_id: call.id,
        result: [{ type: 'text', text: JSON.stringify(result) }]
      });
    }

    current = await client.interactions.create({
      model: request.model,
      input: results,
      previous_interaction_id: previousId,
      tools: allTools
    });
    previousId = current?.id || previousId;
  }

  throw Object.assign(new Error('Trop d’appels de fonctions successifs.'), { status: 400 });
}

async function getClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw Object.assign(new Error('GEMINI_API_KEY n’est pas configurée dans Netlify.'), { status: 500 });
  }
  const { GoogleGenAI } = await import('@google/genai');
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function createInteraction(client, body, model) {
  const schema = sanitizeSchema(body.responseSchema);
  const tools = normalizeTools(body);
  const appTools = body.enableAppFunctions === false ? [] : appFunctionDefinitions(body);
  const agent = body.agent && ALLOWED_AGENTS.has(String(body.agent)) ? String(body.agent) : null;
  const request = {
    model: agent ? undefined : model,
    agent: agent || undefined,
    environment: agent ? 'remote' : undefined,
    input: buildInput(body),
    system_instruction: String(body.system || '').trim() || undefined,
    previous_interaction_id: body.previousInteractionId || undefined,
    store: body.store === false ? false : true,
    background: body.background === true ? true : undefined,
    tools: [...tools, ...appTools],
    response_format: schema ? {
      type: 'text',
      mime_type: 'application/json',
      schema
    } : undefined,
    generation_config: {
      temperature: safeNumber(body.temperature, 0.2, 0, 2),
      max_output_tokens: safeNumber(body.maxTokens, 5000, 200, 20000)
    }
  };

  // Do not combine server-side state with store=false: Google documents that
  // previous_interaction_id/background require stored interactions.
  if (request.store === false) {
    request.previous_interaction_id = undefined;
    request.background = undefined;
  }
  if (body.generateImage === true) request.model = IMAGE_MODELS[0];

  if (body.stream === true) {
    return { stream: await client.interactions.create({ ...request, stream: true }), appTools, request };
  }
  const interaction = await client.interactions.create(request);
  return { interaction, appTools, request };
}

async function collectStream(stream) {
  const chunks = [];
  let completed = null;
  for await (const event of stream) {
    if (event?.event_type === 'step.delta' && event?.delta?.type === 'text') {
      chunks.push(String(event.delta.text || ''));
    }
    if (event?.event_type === 'interaction.completed') completed = event.interaction || completed;
    if (event?.event_type === 'interaction.failed') completed = event.interaction || completed;
  }
  return { interaction: completed, streamedText: chunks.join('') };
}

async function pollBackground(client, id) {
  const interaction = await client.interactions.get(id);
  return interaction;
}

function resultPayload(interaction, model, extra = {}) {
  const media = extractMediaOutput(interaction);
  return {
    ok: true,
    text: extractText(interaction),
    model: interaction?.model || model,
    provider: 'Google Gemini',
    interactionId: interaction?.id || null,
    status: interaction?.status || 'completed',
    citations: extractCitations(interaction),
    image: media.image,
    audio: media.audio,
    steps: stepSummary(interaction?.steps),
    usage: interaction?.usage || null,
    ...extra
  };
}

exports.handler = async event => {
  if (event.httpMethod !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json({ error: 'Requête IA invalide.' }, 400); }

  try {
    const client = await getClient();

    if (body.action === 'poll' && body.interactionId) {
      const interaction = await pollBackground(client, String(body.interactionId));
      return json(resultPayload(interaction, interaction?.model || MODELS[0]));
    }

    const media = normalizeMedia(body);
    const prompt = String(body.prompt || '').trim();
    if (!prompt && !media.length && body.input === undefined) {
      return json({ error: 'Aucun contenu à analyser.' }, 400);
    }

    const mediaBytes = media.reduce((sum, item) => sum + String(item.data || '').length, 0);
    if (mediaBytes > 9500000) {
      return json({ error: 'Les fichiers multimédias sont trop volumineux. Réduis la taille ou le nombre de fichiers.' }, 413);
    }

    const requested = body.generateImage
      ? IMAGE_MODELS[0]
      : String(body.model || MODELS[0]);
    const candidates = body.generateImage
      ? IMAGE_MODELS
      : [...new Set([requested, ...MODELS])];

    let lastError = null;
    for (const model of candidates) {
      try {
        const built = await createInteraction(client, body, model);

        if (built.stream) {
          const streamed = await collectStream(built.stream);
          if (streamed.interaction) {
            return json(resultPayload(streamed.interaction, model, { streamedText: cleanText(streamed.streamedText) }));
          }
          return json({ ok: true, text: cleanText(streamed.streamedText), model, provider: 'Google Gemini', streamedText: cleanText(streamed.streamedText) });
        }

        let interaction = built.interaction;
        if (interaction?.status === 'failed') {
          throw Object.assign(new Error(interaction?.error?.message || 'Gemini a signalé un échec.'), { status: 502 });
        }

        // Function calling: execute only our deterministic, server-defined app functions.
        if ((interaction?.steps || []).some(step => step?.type === 'function_call')) {
          interaction = await executeFunctionLoop(client, interaction, {
            model,
            tools: normalizeTools(body),
            appTools: built.appTools,
            body
          });
        }

        if (body.background === true) {
          return json(resultPayload(interaction, model));
        }

        return json(resultPayload(interaction, model));
      } catch (error) {
        lastError = error;
        console.error(`Gemini interaction failed with ${model}:`, error);
        const status = Number(error?.status || error?.code || 0);
        if (status === 401 || status === 403) break;
        if (status === 400 && body.responseSchema) break;
      }
    }

    const status = Number(lastError?.status || lastError?.code) || 502;
    const message = lastError?.message || 'Le service Gemini est momentanément indisponible.';
    if (status === 429) return json(429, { error: 'Le quota ou la limite de débit Gemini est temporairement atteint. Réessaie plus tard.' });
    if (status === 401 || status === 403) return json(status, { error: 'La clé GEMINI_API_KEY est invalide, expirée ou n’a pas les bonnes autorisations.' });
    return json(502, { error: message });
  } catch (error) {
    console.error('Objectif Bac Gemini error:', error);
    return json(Number(error?.status) || 500, { error: error?.message || 'Impossible d’initialiser Gemini.' });
  }
};
