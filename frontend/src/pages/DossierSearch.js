import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const DB_NAME = 'GestionCourrierFS';
const STORE_NAME = 'handles';
const KEY = 'selectedDir';
const NAME_KEY = 'selectedDirName';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, KEY);
    request.onsuccess = () => {
      localStorage.setItem(NAME_KEY, handle.name);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadDirHandle() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(KEY);
    getReq.onsuccess = () => {
      resolve(getReq.result);   // <-- the actual handle
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

async function clearDirHandle() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(KEY);
  await tx.done;
  localStorage.removeItem(NAME_KEY);
}

async function searchFilesRecursive(dirHandle, term) {
  const results = [];
  if (!dirHandle || dirHandle.kind !== 'directory' || typeof dirHandle.entries !== 'function') {
    console.warn('Invalid handle:', dirHandle);
    throw new Error('invalid_handle');
  }
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && name.toLowerCase().includes(term)) {
      results.push({ name, handle });
    } else if (handle.kind === 'directory') {
      try {
        const sub = await searchFilesRecursive(handle, term);
        for (const f of sub) results.push({ name: `${name}/${f.name}`, handle: f.handle });
      } catch (e) { console.warn('skip dir', e); }
    }
  }
  return results;
}

function DossierSearch() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  const [dirHandle, setDirHandle] = useState(null);
  const [dirDisplayName, setDirDisplayName] = useState('');   // for visual
  const [results, setResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFileUrl, setSelectedFileUrl] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    loadDirHandle().then((handle) => {
      console.log('Loaded handle from IndexedDB:', handle);
      if (handle) {
        if (handle.kind === 'directory' && typeof handle.entries === 'function') {
          setDirHandle(handle);
          setDirDisplayName(handle.name || localStorage.getItem(NAME_KEY) || '');
        } else {
          // Handle is corrupt – show saved name and signal error
          const savedName = localStorage.getItem(NAME_KEY);
          if (savedName) setDirDisplayName(savedName);
          setError(t('dossier_invalid_handle') || 'The saved folder is no longer accessible. Please re‑select it.');
          console.warn('Handle invalid, missing kind/entries');
        }
      }
    }).catch((err) => {
      console.error('Error loading handle:', err);
    });
  }, []);

  useEffect(() => {
    return () => { if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl); };
  }, [selectedFileUrl]);

  const selectFolder = async () => {
    try {
      const handle = await window.showDirectoryPicker();
      await saveDirHandle(handle);
      setDirHandle(handle);
      setDirDisplayName(handle.name);
      setError('');
      setResults([]);
      setSearchTerm('');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(t('dossier_api_error') || 'Folder selection not supported.');
      }
    }
  };

  const forgetFolder = async () => {
    await clearDirHandle();
    setDirHandle(null);
    setDirDisplayName('');
    setResults([]);
    setSearchTerm('');
    setSelectedFileUrl(null);
    setError('');
  };

  const openFileInViewer = async (fileHandle) => {
    try {
      if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
      const file = await fileHandle.getFile();
      const url = URL.createObjectURL(file);
      setSelectedFileUrl(url);
      setSelectedFileName(fileHandle.name);
    } catch (err) { setError(t('open_error')); }
  };

  const closeViewer = () => {
    if (selectedFileUrl) URL.revokeObjectURL(selectedFileUrl);
    setSelectedFileUrl(null);
    setSelectedFileName('');
  };

  const ensurePermission = async () => {
    if (!dirHandle) return;
    const opts = { mode: 'read' };
    try {
      if (
        dirHandle.queryPermission &&
        (await dirHandle.queryPermission(opts)) !== 'granted'
      ) {
        await dirHandle.requestPermission(opts);
      }
    } catch (e) {
      console.warn('Permission request failed (will try anyway):', e);
    }
  };

  const handleSearch = async () => {
    if (!dirHandle) {
      setError(t('select_folder_first') || 'Please select a folder first.');
      return;
    }
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await ensurePermission();
      const term = searchTerm.trim().toLowerCase();
      const found = await searchFilesRecursive(dirHandle, term);
      setResults(found);
      if (found.length === 0) {
        setError(t('no_results'));
        closeViewer();
      } else if (found.length === 1) {
        openFileInViewer(found[0].handle);
      } else {
        const exactMatch = found.find(
          (f) => f.name.toLowerCase() === term || f.name.replace(/\.[^/.]+$/, '').toLowerCase() === term
        );
        if (exactMatch) {
          openFileInViewer(exactMatch.handle);
        } else {
          closeViewer();
        }
      }
    } catch (err) {
      if (err.message === 'invalid_handle') {
        await clearDirHandle();
        setDirHandle(null);
        setError(t('dossier_invalid_handle') || 'Folder no longer accessible. Please re‑select it.');
      } else {
        setError(err.message || t('search_error'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" dir="rtl">
      <h1 className="page-title">{t('dossier_search_title')}</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="form-card">
        <div className="form-grid">
          <div className="form-field full-width">
            <label>{t('selected_folder')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                value={dirHandle ? dirHandle.name : dirDisplayName || t('no_folder_selected')}
                disabled
                style={{ flex: 1 }}
              />
              <button className="btn-secondary" onClick={selectFolder}>
                {t('choose_folder')}
              </button>
              {dirHandle && (
                <button className="btn-secondary" onClick={forgetFolder} title={t('forget_folder')}>🗑️</button>
              )}
            </div>
          </div>

          <div className="form-field full-width">
            <label>{t('file_name')}</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('search_placeholder')}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1 }}
              />
              <button className="btn-primary" onClick={handleSearch} disabled={loading}>
                {loading ? t('searching') : t('search')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`dossier-viewer-layout ${isRtl ? 'rtl-layout' : 'ltr-layout'}`}>
        <div className="dossier-sidebar">
          <div className="data-table-wrapper" style={{ marginTop: 0 }}>
            <h3>{t('results')} ({results.length})</h3>
            {results.length === 0 && !loading && searchTerm.trim() !== '' && (
              <div className="text-muted">{t('no_results')}</div>
            )}
            {results.length > 0 && (
              <div className="dossier-file-list">
                {results.map((item, idx) => (
                  <div
                    key={idx}
                    className={`dossier-file-item ${selectedFileName === item.name ? 'active' : ''}`}
                    onClick={() => openFileInViewer(item.handle)}
                  >
                    <span className="file-name">{item.name}</span>
                    <button className="btn-secondary btn-small">{t('consulter')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="dossier-pdf-viewer">
          {selectedFileUrl ? (
            <div className="pdf-viewer-wrapper">
              <div className="registry-panel-header">
                <h3>{selectedFileName}</h3>
                <button className="btn-secondary" onClick={closeViewer}>{t('fermer')}</button>
              </div>
              <iframe src={selectedFileUrl} title="PDF Viewer" className="pdf-iframe-full" />
            </div>
          ) : (
            <div className="text-muted" style={{ padding: '2rem' }}>
              {t('select_file_to_view')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DossierSearch;