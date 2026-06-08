import React from 'react';
import { useTranslation } from 'react-i18next';

function DocumentModal({ document, onClose }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';

  if (!document) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  };

  const getValue = (field) => {
    switch (field) {
      case 'date': return document.date || document.dateCreation || document.dateArchivage || document.dateEnvoi || document.dateArrivee;
      case 'etat': return document.etat || document.etatArchive || document.statut;
      case 'source': return document.source || document.tribunalSource || document.sourceServiceNom;
      case 'numeroDossier': return document.numeroDossier || document.numeroDossierJudiciaire ||
        (document.numeroDossierAnnee
          ? `${document.numeroDossierAnnee}/${document.numeroDossierNombre}/${document.numeroDossierSujet}`
          : null);
      case 'service': return document.serviceNom || document.Service?.nomService || document.destinationServiceNom;
      case 'destinataire': return document.destinataire || document.destinationServiceNom;
      case 'typeDocument': return document.typeDocument || document.type;
      default: return document[field];
    }
  };

  const renderValue = (key, value) => {
    if (value === undefined || value === null || value === '') return null;
    if (key === 'estTransmissible') return value ? t('oui') : t('non');
    if (key.includes('date')) return formatDate(value);
    if (typeof value === 'object') return null;
    return String(value);
  };

  const fields = [
    { key: 'id', label: 'ID' },
    { key: 'idBureauOrdre', label: t('numero_bureau_ordre') },
    { key: 'numeroDossier', label: t('numero_dossier_judiciaire') },
    { key: 'numeroPremiereInstance', label: t('numero_premiere_instance') },
    { key: 'numeroDeCourrier', label: t('numero_courrier') },
    { key: 'numeroCourrier', label: t('numero_courrier_transaction') },
    { key: 'typeDocument', label: t('type_document') },
    { key: 'date', label: t('date') },
    { key: 'sujet', label: t('objet') },
    { key: 'source', label: t('source') },
    { key: 'destinataire', label: t('destinataire') },
    { key: 'service', label: t('service') },
    { key: 'etat', label: t('etat') },
    { key: 'direction', label: t('direction') },
    { key: 'typeRegistre', label: t('type_registre') },
    { key: 'typeCorrespondance', label: t('type_correspondance') },
    { key: 'emplacement', label: t('emplacement') },
    { key: 'estTransmissible', label: t('transmissible') },
    { key: 'message', label: t('message') },
    { key: 'description', label: t('description') },
  ];

  const retraits = document.retraits;
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

  const isTransaction = document.hasOwnProperty('documentId') || document.hasOwnProperty('statut');
  const docTitle = document.sujet || document.documentSujet || 'Document';

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal modal-document" onClick={(e) => e.stopPropagation()}>
        <div className="registry-panel-header">
          <div>
            <h2>{t('details_document')}</h2>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.95rem', color: '#666' }}>{docTitle}</p>
          </div>
          <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
        </div>

        <div className={`modal-document-row ${isRtl ? 'rtl-direction' : 'ltr-direction'}`}>
          <div className="modal-info-section">
            <div className="form-grid">
              {fields.map((field) => {
                const value = getValue(field.key);
                const rendered = renderValue(field.key, value);
                if (!rendered) return null;
                return (
                  <div className="form-field" key={field.key}>
                    <label>{field.label}:</label>
                    <span style={{ fontWeight: '500', color: '#333' }}>{rendered}</span>
                  </div>
                );
              })}
            </div>

            {isTransaction && document.destinationUserName && (
              <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0f7ff', borderRadius: '8px', border: '1px solid #d0e8ff' }}>
                <h3 style={{ marginTop: 0, color: '#0c4a6e' }}>{t('transaction_details') || 'تفاصيل العملية'}</h3>
                <div className="form-grid">
                  {document.destinationServiceName && (
                    <div className="form-field">
                      <label>{t('service_destinataire')}:</label>
                      <span style={{ fontWeight: '500' }}>{document.destinationServiceName}</span>
                    </div>
                  )}
                  {document.destinationUserName && (
                    <div className="form-field">
                      <label>{t('personne')}:</label>
                      <span style={{ fontWeight: '500' }}>{document.destinationUserName}</span>
                    </div>
                  )}
                  {document.dateEnvoi && (
                    <div className="form-field">
                      <label>{t('date_envoi')}:</label>
                      <span style={{ fontWeight: '500' }}>{formatDate(document.dateEnvoi)}</span>
                    </div>
                  )}
                  {document.statut && (
                    <div className="form-field">
                      <label>{t('statut')}:</label>
                      <span style={{ fontWeight: '500', padding: '0.3rem 0.6rem', background: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>{document.statut}</span>
                    </div>
                  )}
                  {document.messageReponse && (
                    <div className="form-field full-width">
                      <label>{t('reponse')}:</label>
                      <span style={{ whiteSpace: 'pre-wrap' }}>{document.messageReponse}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {retraits && retraits.length > 0 && (
              <>
                <h3 style={{ marginTop: '1.5rem' }}>{t('historique_retraits')}</h3>
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
            {!pdfUrl && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#999' }}>
                <p>{t('aucun_document_attache') || 'لا توجد وثيقة مرفقة'}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentModal;