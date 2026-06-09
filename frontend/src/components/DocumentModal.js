import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

function DocumentModal({ document, onClose }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const isRtl = i18n.dir() === 'rtl';
  const locale = i18n.language;
  const role = user?.role;

  const [listItems, setListItems] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const showBureauOrdre = role === 'Admin' || role === 'Directeur' || role === 'Greffier';

  useEffect(() => {
    const fetchLists = async () => {
      const listNames = [
        'Source', 'TribunalType', 'DocumentState', 'EquipmentType',
        'JudicialType', 'LinkedDocumentSource', 'LinkedDocumentType',
        'Direction', 'CorrespondanceType', 'TypeRegistre'
      ];
      const promises = listNames.map(name =>
        axios.get(`/api/ListItems?listName=${name}`).then(res => ({ [name]: res.data }))
      );
      const results = await Promise.all(promises);
      setListItems(Object.assign({}, ...results));
    };
    if (document) fetchLists();
  }, [document]);

  useEffect(() => {
    if (!document) return;
    const fetchTransactions = async () => {
      setLoadingTx(true);
      try {
        const docId = document.id || document.idEntite;
        const docType = document.typeDocument || (document.tribunalSource ? 'Judiciaire' : 'Administratif');
        const res = await axios.get(`/api/transactions/history/${docId}?type=${docType}`);
        const acceptedTx = res.data.filter(tx => tx.statut === 'Accepté');
        setTransactions(acceptedTx);
      } catch (err) {
        console.error('Failed to load transaction history', err);
        setTransactions([]);
      } finally {
        setLoadingTx(false);
      }
    };
    fetchTransactions();
  }, [document]);

  if (!document) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? String(value) : d.toLocaleString();
  };

  const resolveCode = (listName, code) => {
    if (code == null || code === '') return '-';
    const list = listItems[listName];
    if (!list) return String(code);
    const item = list.find(i => i.code == code);
    if (!item) return String(code);
    return locale === 'ar' ? item.valueAr : item.valueFr;
  };

  const safeString = (value) => {
    if (value === undefined || value === null) return '-';
    if (typeof value === 'string') return value === '' ? '-' : value;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value ? t('oui') : t('non');
    if (Array.isArray(value)) return value.length ? value.map(safeString).join(', ') : '-';
    if (typeof value === 'object') {
      if (value.$values && Array.isArray(value.$values)) return value.$values.map(safeString).join(', ');
      if (value.annee !== undefined && value.nombre !== undefined && value.numeroSujet !== undefined) {
        return `${value.annee}/${value.nombre}/${value.numeroSujet}`;
      }
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  };

  const isJudicial = () => {
    const type = document.typeDocument;
    if (type && type.toLowerCase() === 'judiciaire') return true;
    return !!(document.cabinet || document.numeroPremiereInstance || document.tribunalSource || document.estDocumentLie !== undefined);
  };

  const isAdministratif = () => {
    const type = document.typeDocument;
    if (type && type.toLowerCase() === 'administratif') return true;
    return !!(document.typeRegistre || document.direction);
  };

  const getTypeRegistreLabel = () => {
    if (isJudicial()) {
      if (document.estDocumentLie === true) {
        return locale === 'ar' ? 'وثيقة مربوطة' : 'Document lié';
      }
      return locale === 'ar' ? 'واردات قضائي' : 'Entrant (Judiciaire)';
    }
    if (isAdministratif()) {
      if (document.typeRegistre === 'Waridat') {
        return locale === 'ar' ? 'واردات إداري' : 'Entrant (Administratif)';
      }
      if (document.typeRegistre === 'Morasalat' && document.typeCorrespondance === 'Sortante') {
        return locale === 'ar' ? 'صادر' : 'Sortant';
      }
      if (document.direction === 'Sortant') {
        return locale === 'ar' ? 'صادر' : 'Sortant';
      }
      return locale === 'ar' ? 'واردات إداري' : 'Entrant (Administratif)';
    }
    return '-';
  };

  const getTypeDossierLabel = () => {
    if (isJudicial()) {
      if (document.estDocumentLie === true) {
        return locale === 'ar' ? 'وثيقة مربوطة بملف' : 'Document lié au dossier';
      }
      return locale === 'ar' ? 'ملف' : 'Dossier principal';
    }
    return null;
  };

const getDisplayValue = (key, rawValue) => {
  if (rawValue === undefined || rawValue === null) return '-';
  switch (key) {
    case 'etat':
    case 'etatArchive':
      return resolveCode('DocumentState', rawValue);
    case 'source':
      return resolveCode('Source', rawValue);
    case 'tribunalSource':
      return resolveCode('TribunalType', rawValue);
    case 'destinataire':
      return resolveCode('Source', rawValue); // same list as source
    case 'typeJudiciaire':
      return resolveCode('JudicialType', rawValue);
    case 'linkedDocumentSource':
      return resolveCode('LinkedDocumentSource', rawValue);
    case 'linkedDocumentType':
      return resolveCode('LinkedDocumentType', rawValue);
    case 'direction':
      return resolveCode('Direction', rawValue);
    case 'typeCorrespondance':
      return resolveCode('CorrespondanceType', rawValue);
    case 'typeRegistre':
      return resolveCode('TypeRegistre', rawValue);
    case 'date':
    case 'dateCreation':
    case 'dateArchivage':
    case 'dateEnvoi':
    case 'dateReponse':
      return formatDate(rawValue);
    case 'estTransmissible':
      return rawValue ? t('oui') : t('non');
    default:
      return safeString(rawValue);
  }
};

  const allFields = { ...document };
  if (document.service) {
    allFields.serviceNom = document.service.nomService;
  }
  if (document.numeroDossier && typeof document.numeroDossier === 'object') {
    allFields.numeroDossier = safeString(document.numeroDossier);
  }

  const fieldOrder = [
    'idBureauOrdre', 'numeroDossier', 'numeroPremiereInstance', 'numeroDeCourrier',
    'date', 'sujet', 'source', 'tribunalSource', 'destinataire',
    'etat', 'direction', 'typeRegistre', 'typeCorrespondance',
    'typeDocument', 'emplacement', 'typeJudiciaire',
    'linkedDocumentSource', 'linkedDocumentType', 'estTransmissible', 'description'
  ];

  const displayFields = fieldOrder
    .filter(field => !(field === 'idBureauOrdre' && !showBureauOrdre))
    .map(key => ({ key, value: allFields[key] }))
    .filter(field => field.value !== undefined);

  const computedTypeRegistre = getTypeRegistreLabel();
  const computedTypeDossier = getTypeDossierLabel();
  const retraits = document.retraits || [];
  const pdfUrl = document.lienPdf;
  const isPdf = pdfUrl && pdfUrl.toLowerCase().endsWith('.pdf');
  const isWord = pdfUrl && (pdfUrl.toLowerCase().endsWith('.doc') || pdfUrl.toLowerCase().endsWith('.docx'));

  const getFullUrl = (url) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    const backendUrl = process.env.REACT_APP_API_URL || 'http://localhost:5127';
    return `${backendUrl}${normalized}`;
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal modal-document" onClick={(e) => e.stopPropagation()}>
        <div className="registry-panel-header">
          <h2>{t('details_document')}</h2>
          <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
        </div>

        <div className={`modal-document-row ${isRtl ? 'rtl-direction' : 'ltr-direction'}`}>
          <div className="modal-info-section">
            {/* Document fields */}
            <div className="form-grid">
              <div className="form-field">
                <label>{t('type_registre')}:</label>
                <span>{computedTypeRegistre}</span>
              </div>
              {computedTypeDossier && (
                <div className="form-field">
                  <label>{t('type_dossier')}:</label>
                  <span>{computedTypeDossier}</span>
                </div>
              )}
              {displayFields.map(({ key, value }) => (
                <div className="form-field" key={key}>
                  <label>{t(key) || key}:</label>
                  <span>{getDisplayValue(key, value)}</span>
                </div>
              ))}
            </div>

            {/* Transaction history – only accepted */}
            <div style={{ marginTop: '1.5rem' }}>
              <h3>{t('historique_transactions')}</h3>
              {loadingTx && <div className="loading">{t('chargement')}</div>}
              {!loadingTx && transactions.length === 0 && (
                <p className="text-muted">{t('aucune_transaction_acceptee')}</p>
              )}
              {!loadingTx && transactions.length > 0 && (
                <div className="data-table-wrapper">
                  <table className="modern-table">
                    <thead>
                      <tr>
                        <th>{t('date_envoi')}</th>
                        <th>{t('service_source')}</th>
                        <th>{t('service_destinataire')}</th>
                        <th>{t('accepte_par')}</th>
                        <th>{t('date_acceptation')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id}>
                          <td className="date-column">{formatDate(tx.dateEnvoi)}</td>
                          <td className="source-service">{tx.sourceServiceName || '-'}</td>
                          <td className="dest-service">{tx.destinationServiceName || '-'}</td>
                          <td>{tx.acceptedByUserName || '-'}</td>
                          <td>{formatDate(tx.acceptedDate || tx.dateReponse)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Retraits section – only for judicial documents (archived or not) */}
            {isJudicial() && (
              <>
                <h3 style={{ marginTop: '1rem' }}>{t('historique_retraits')}</h3>
                {retraits.length === 0 ? (
                  <p className="text-muted">{t('aucun_retrait')}</p>
                ) : (
                  <div className="data-table-wrapper">
                    <table className="modern-table">
                      <thead>
                        <tr>
                          <th>{t('date_retrait')}</th>
                          <th>{t('motif_retrait')}</th>
                          <th>{t('effectue_par')}</th>
                          <th>{t('date_retour')}</th>
                          <th>{t('notes')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retraits.map((r, idx) => (
                          <tr key={idx}>
                            <td>{formatDate(r.dateDeRetrait)}</td>
                            <td>{r.motifDeRetrait || '-'}</td>
                            <td>{r.effectuePar || '-'}</td>
                            <td>{r.dateDeRetour ? formatDate(r.dateDeRetour) : '-'}</td>
                            <td>{r.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="modal-pdf-section">
            {pdfUrl && isPdf && (
              <>
                <div className="modal-pdf-header">
                  <h3>{t('document_pdf_word')}</h3>
                  <a href={getFullUrl(pdfUrl)} target="_blank" rel="noreferrer" className="btn-secondary">
                    📄 {t('ouvrir_fenetre')}
                  </a>
                </div>
                <iframe src={getFullUrl(pdfUrl)} title="PDF Viewer" className="pdf-iframe" />
              </>
            )}
            {pdfUrl && isWord && (
              <>
                <h3>{t('document_pdf_word')}</h3>
                <div className="form-field">
                  <a href={getFullUrl(pdfUrl)} target="_blank" rel="noreferrer" className="btn-primary">
                    📥 {t('ouvrir')}
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentModal;