import React from 'react';
import { useTranslation } from 'react-i18next';

function DocumentModal({ document, onClose }) {
  const { t } = useTranslation();
  if (!document) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleString();
  };

  // Fonction pour récupérer la valeur d'un champ selon le type de document
  const getFieldValue = (field) => {
    switch (field) {
      case 'numeroDossier':
        // Pour les judiciaires : numeroDossier (string) ou composants
        if (document.numeroDossier) return document.numeroDossier;
        if (document.numeroDossierAnnee && document.numeroDossierNombre && document.numeroDossierSujet) {
          return `${document.numeroDossierAnnee}/${document.numeroDossierNombre}/${document.numeroDossierSujet}`;
        }
        return '-';
      case 'idBureauOrdre':
        return document.idBureauOrdre || '-';
      case 'sujet':
        return document.sujet || '-';
      case 'tribunalSource':
        // Pour judiciaire : tribunalSource, pour administratif : source
        return document.tribunalSource || document.source || '-';
      case 'destinataire':
        return document.destinataire || '-';
      case 'date':
        return formatDate(document.date || document.dateCreation || document.dateArchivage);
      case 'emplacement':
        return document.emplacement || '-';
      case 'etat':
        return document.etat || document.etatArchive || '-';
      case 'direction':
        return document.direction || '-';
      case 'estTransmissible':
        return document.estTransmissible ? (t('oui') || 'نعم') : (t('non') || 'لا');
      case 'retraitsCount':
        return document.retraitsCount ?? 0;
      default:
        return '-';
    }
  };

  // Liste des champs dans l'ordre souhaité
  const fields = [
    { label: t('numero_dossier') || 'الرقم الاستئنافي للملف', key: 'numeroDossier' },
    { label: t('numero_bureau_ordre') || 'رقم مكتب الضبط', key: 'idBureauOrdre' },
    { label: t('objet') || 'الموضوع', key: 'sujet' },
    { label: t('tribunal_source') || 'المحكمة / المصدر', key: 'tribunalSource' },
    { label: t('destinataire') || 'المرسل إليه', key: 'destinataire' },
    { label: t('date') || 'التاريخ', key: 'date' },
    { label: t('emplacement') || 'الموقع', key: 'emplacement' },
    { label: t('etat') || 'الحالة', key: 'etat' },
    { label: t('transmissible') || 'قابل للإحالة', key: 'estTransmissible' },
    { label: t('retraits') || 'السحوبات', key: 'retraitsCount' },
  ];

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="registry-panel-header">
          <h2>{t('details_document')}</h2>
          <button className="btn-secondary" onClick={onClose}>{t('fermer')}</button>
        </div>
        <div className="form-grid">
          {fields.map((field) => {
            const value = getFieldValue(field.key);
            if (value === undefined || value === null || value === '') return null;
            return (
              <div className="form-field" key={field.key}>
                <label>{field.label} :</label>
                <span>{value}</span>
              </div>
            );
          })}
        </div>
        <div className="form-actions">
          <button className="btn-primary" onClick={onClose}>{t('fermer')}</button>
        </div>
      </div>
    </div>
  );
}

export default DocumentModal;