/* Objectif Bac — Gemini API (official @google/genai + Interactions API)
 * Secret: GEMINI_API_KEY stays server-side in Netlify.
 * The browser calls only /.netlify/functions/ai.
 */

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview'
];
const IMAGE_MODEL = 'gemini-3.1-flash-image';
const ALLOWED_TOOLS = new Set(['google_search','url_context','code_execution','file_search']);
const ALLOWED_AGENTS = new Set([
  'antigravity-preview-09-2026',
  'deep-research-preview-04-2026',
  'deep-research-max-preview-04-2026'
]);

function json(body, status = 200, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
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

function defaultMime(type) {
  return ({
    image: 'image/jpeg',
    audio: 'audio/mpeg',
    video: 'video/mp4',
    document: 'application/pdf'
  })[type] || 'application/octet-stream';
}

function normalizeContentItem(item) {
  if (!item || typeof item !== 'object') return null;
  const type = String(item.type || '').toLowerCase();
  if (!['image','audio','video','document'].includes(type)) return null;

  const out = { type };
  if (item.data) {
    const data = String(item.data);
    if (data.length > 8500000) return null;
    out.data = data;
    out.mime_type = String(item.mime_type || item.mimeType || defaultMime(type));
  } else if (item.uri) {
    out.uri = String(item.uri);
    if (item.mime_type || item.mimeType) out.mime_type = String(item.mime_type || item.mimeType);
  } else return null;
  return out;
}

function normalizeMedia(body) {
  const media = [];
  const supplied = Array.isArray(body.media) ? body.media : [];
  const legacyImages = Array.isArray(body.images)
    ? body.images.map(im => ({ type: 'image', data: im?.data, mime_type: im?.type || im?.mime_type }))
    : [];
  for (const item of [...supplied, ...legacyImages]) {
    const normalized = normalizeContentItem(item);
    if (normalized) media.push(normalized);
    if (media.length >= 12) break;
  }
  return media;
}

function buildInput(body) {
  if (body.input !== undefined && body.input !== null) return body.input;
  const content = [];
  const prompt = String(body.prompt || '').trim();
  if (prompt) content.push({ type: 'text', text: prompt });
  content.push(...normalizeMedia(body));
  return content.length === 1 && content[0].type === 'text'
    ? content[0].text
    : (content.length ? content : 'Réponds à la demande de l’élève.');
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
  return [...new Map(tools.map(t => [JSON.stringify(t), t])).values()];
}

function sanitizeSchema(schema) {
  if (!schema || typeof schema !== 'object') return null;
  try {
    const copy = JSON.parse(JSON.stringify(schema));
    return JSON.stringify(copy).length <= 100000 ? copy : null;
  } catch { return null; }
}

function appFunctionDefinitions(enabled = true) {
  if (!enabled) return [];
  return [
    {
      type: 'function',
      name: 'get_current_date',
      description: 'Returns the current date and time in Europe/Paris.',
      parameters: { type: 'object', properties: {} }
    },
    {
      type: 'function',
      name: 'get_objectif_bac_subjects',
      description: 'Returns the subjects configured in Objectif Bac.',
      parameters: { type: 'object', properties: {} }
    }
  ];
}

function executeAppFunction(name, args, body) {
  if (name === 'get_current_date') {
    return { iso: new Date().toISOString(), timezone: 'Europe/Paris' };
  }
  if (name === 'get_objectif_bac_subjects') {
    return {
      subjects: Array.isArray(body.appSubjects) && body.appSubjects.length
        ? body.appSubjects
        : ['HGGSP (Spécialité)','SES (Spécialité)','Histoire-Géographie','Philosophie','Anglais','Espagnol','Maths','SVT','Physique-Chimie','EMC','EPS']
    };
  }
  throw Object.assign(new Error(`Fonction non autorisée : ${name}`), { status: 400 });
}

function extractFunctionCalls(interaction) {
  return (interaction?.steps || [])
    .filter(step => step?.type === 'function_call')
    .map(step => ({
      id: step.id,
      name: step.name,
      arguments: typeof step.arguments === 'object' ? step.arguments : {}
    }));
}

function functionResultInput(call, result) {
  return {
    type: 'function_result',
    name: call.name,
    call_id: call.id,
    result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
  };
}

async function runFunctionLoop(client, interaction, body, requestOptions) {
  let current = interaction;
  for (let round = 0; round < 5; round++) {
    const calls = extractFunctionCalls(current);
    if (!calls.length) return current;
    const appTools = appFunctionDefinitions(body.enableAppFunctions !== false);
    const results = calls.map(call => {
      if (!appTools.some(tool => tool.name === call.name)) {
        throw Object.assign(new Error(`Fonction non autorisée : ${call.name}`), { status: 400 });
      }
      return functionResultInput(call, executeAppFunction(call.name, call.arguments, body));
    });
    current = await client.interactions.create({
      model: requestOptions.model,
      input: results,
      previous_interaction_id: current.id,
      tools: requestOptions.tools
    });
    if (current?.status === 'failed') {
      throw Object.assign(new Error(current?.error?.message || 'Gemini a signalé un échec.'), { status: 502 });
    }
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

function buildRequest(body, model) {
  const schema = sanitizeSchema(body.responseSchema);
  const tools = normalizeTools(body);
  const appTools = appFunctionDefinitions(body.enableAppFunctions !== false);
  const agent = body.agent && ALLOWED_AGENTS.has(String(body.agent)) ? String(body.agent) : null;

  const request = {
    input: buildInput(body),
    system_instruction: String(body.system || '').trim() || undefined,
    previous_interaction_id: body.previousInteractionId || undefined,
    store: body.store === false ? false : true,
    background: body.background === true ? true : undefined,
    tools: [...tools, ...appTools],
    generation_config: {
      max_output_tokens: safeNumber(body.maxTokens, 5000, 200, 20000),
      temperature: safeNumber(body.temperature, 0.2, 0, 2)
    }
  };

  if (agent) {
    request.agent = agent;
    request.environment = 'remote';
    request.agent_config = body.agentConfig && typeof body.agentConfig === 'object' ? body.agentConfig : undefined;
    delete request.generation_config;
  } else {
    request.model = model;
  }

  if (schema) {
    request.response_format = {
      type: 'text',
      mime_type: 'application/json',
      schema
    };
  }

  if (body.generateImage === true) {
    request.model = IMAGE_MODEL;
    request.response_format = [
      { type: 'text' },
      { type: 'image' }
    ];
    delete request.generation_config;
  }

  if (request.store === false) {
    delete request.previous_interaction_id;
    delete request.background;
  }

  return request;
}

function extractText(interaction) {
  if (typeof interaction?.output_text === 'string' && interaction.output_text.trim()) {
    return cleanText(interaction.output_text);
  }
  const blocks = [];
  for (const step of (interaction?.steps || [])) {
    if (step?.type !== 'model_output') continue;
    for (const block of (step.content || [])) {
      if (block?.type === 'text') blocks.push(block.text || '');
    }
  }
  return cleanText(blocks.join(''));
}

function extractCitations(interaction) {
  const out = [];
  for (const step of (interaction?.steps || [])) {
    for (const block of (step?.content || [])) {
      for (const annotation of (block?.annotations || [])) {
        if (annotation?.type === 'url_citation' && annotation.url) {
          out.push({
            url: annotation.url,
            title: annotation.title || annotation.url,
            startIndex: annotation.start_index,
            endIndex: annotation.end_index
          });
        }
      }
    }
  }
  return out;
}

function extractMediaOutput(interaction) {
  const image = interaction?.output_image;
  const audio = interaction?.output_audio;
  return {
    image: image?.data ? { data: image.data, mime_type: image.mime_type || 'image/png' } : null,
    audio: audio?.data ? { data: audio.data, mime_type: audio.mime_type || 'audio/wav' } : null
  };
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
    steps: (interaction?.steps || []).map(step => ({ id: step?.id || null, type: step?.type || null, name: step?.name || null, call_id: step?.call_id || null })),
    usage: interaction?.usage || null,
    ...extra
  };
}

async function collectStream(stream) {
  let interaction = null;
  let interactionId = null;
  const textChunks = [];
  const functionCalls = new Map();
  for await (const event of stream) {
    if (event?.event_type === 'interaction.created') {
      interaction = event.interaction || interaction;
      interactionId = event.interaction?.id || interactionId;
    } else if (event?.event_type === 'step.start' && event.step?.type === 'function_call') {
      functionCalls.set(event.step.id, { id: event.step.id, name: event.step.name, arguments: event.step.arguments || {} });
    } else if (event?.event_type === 'step.delta') {
      if (event.delta?.type === 'text') textChunks.push(String(event.delta.text || ''));
      if (event.delta?.type === 'arguments_delta') {
        const target = [...functionCalls.values()].at(-1);
        if (target) {
          const fragment = String(event.delta.arguments || '');
          target.arguments = String(target.arguments || '') + fragment;
        }
      }
    } else if (event?.event_type === 'interaction.completed') {
      interaction = event.interaction || interaction;
    }
  }
  return { interaction, interactionId, streamedText: cleanText(textChunks.join('')), functionCalls: [...functionCalls.values()] };
}

async function pollBackground(client, id) {
  return client.interactions.get(id);
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

    if (body.action === 'health') {
      return json({ ok: true, configured: true, provider: 'Google Gemini', sdk: '@google/genai', interactions: true });
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

    const requested = body.generateImage ? IMAGE_MODEL : String(body.model || MODELS[0]);
    const candidates = body.generateImage ? [IMAGE_MODEL] : [...new Set([requested, ...MODELS])];
    let lastError = null;

    for (const model of candidates) {
      try {
        const request = buildRequest(body, model);
        const wantsStream = body.stream === true;

        if (wantsStream) {
          const stream = await client.interactions.create({ ...request, stream: true });
          const streamed = await collectStream(stream);
          const status = streamed.interaction?.status;

          if (status === 'requires_action' && streamed.functionCalls.length) {
            const results = streamed.functionCalls.map(call => {
              let args = {};
              try { args = typeof call.arguments === 'string' ? JSON.parse(call.arguments || '{}') : (call.arguments || {}); } catch {}
              const result = executeAppFunction(call.name, args, body);
              return functionResultInput({ id: call.id, name: call.name }, result);
            });
            const resumed = await client.interactions.create({
              model,
              previous_interaction_id: streamed.interactionId,
              input: results,
              tools: request.tools,
              stream: true
            });
            const second = await collectStream(resumed);
            return json({
              ...(second.interaction ? resultPayload(second.interaction, model) : { ok: true, text: second.streamedText, model, provider: 'Google Gemini' }),
              streamedText: second.streamedText
            });
          }

          return json({
            ...(streamed.interaction ? resultPayload(streamed.interaction, model) : { ok: true, text: streamed.streamedText, model, provider: 'Google Gemini' }),
            streamedText: streamed.streamedText
          });
        }

        let interaction = await client.interactions.create(request);
        if (interaction?.status === 'failed') {
          throw Object.assign(new Error(interaction?.error?.message || 'Gemini a signalé un échec.'), { status: 502 });
        }

        if (interaction?.status === 'requires_action') {
          interaction = await runFunctionLoop(client, interaction, body, request);
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
    const raw = String(lastError?.message || 'Le service Gemini est momentanément indisponible.');
    if (status === 429) return json({ error: 'Le quota ou la limite de débit Gemini est temporairement atteint. Réessaie plus tard.' }, 429);
    if (status === 401 || status === 403) return json({ error: 'La clé GEMINI_API_KEY est invalide, expirée ou n’a pas les bonnes autorisations.' }, status);
    return json({ error: raw }, 502);
  } catch (error) {
    console.error('Objectif Bac Gemini error:', error);
    return json({ error: error?.message || 'Impossible d’initialiser Gemini.' }, Number(error?.status) || 500);
  }
};
