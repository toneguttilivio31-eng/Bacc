const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée.' })
    };
  }

  try {
    const { author, timestamp, payload } = JSON.parse(event.body || '{}');
    const store = getStore('bac-2027-store');

    const rawCloudData = await store.get('global_state');
    let cloudState = rawCloudData ? JSON.parse(rawCloudData) : null;

    if (payload && (!cloudState || timestamp > (cloudState.timestamp || 0))) {
      cloudState = { author, timestamp, payload };
      await store.set('global_state', JSON.stringify(cloudState));
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloudState || { timestamp: 0, payload: null })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Erreur Netlify Blobs : ${err.message}` })
    };
  }
};
