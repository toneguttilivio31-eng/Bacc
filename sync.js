// Sync Engine local/cloud
const STORAGE_KEY = 'ob_courses_v3';

export const SyncEngine = {
  getUser() {
    return localStorage.getItem('ob_user') || 'Livio';
  },

  setUser(name) {
    localStorage.setItem('ob_user', name);
  },

  async sync(localState) {
    try {
      const response = await fetch('/.netlify/functions/sync-blobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: this.getUser(),
          timestamp: Date.now(),
          payload: localState
        })
      });

      if (!response.ok) throw new Error('Échec de réponse du serveur.');

      const remoteData = await response.json();
      if (remoteData && remoteData.payload && remoteData.timestamp > (localState.lastSync || 0)) {
        return { updated: true, data: remoteData.payload };
      }
    } catch (err) {
      console.warn('Mode hors-ligne : synchronisation en attente.', err.message);
    }
    return { updated: false, data: localState };
  }
};
