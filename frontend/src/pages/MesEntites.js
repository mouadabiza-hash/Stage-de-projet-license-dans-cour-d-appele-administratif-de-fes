import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import DocumentModal from '../components/DocumentModal';

function MesEntites() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [transferForm, setTransferForm] = useState({ serviceId: '', userId: '', doitRevenir: false, message: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDocument, setModalDocument] = useState(null);
  // Pagination
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchDocuments();
    fetchServices();
  }, []);

  // Reset page when total documents count changes
  useEffect(() => {
    setCurrentPage(1);
  }, [documents.length]);

  const fetchDocuments = async () => {
    try {
      const res = await axios.get('/api/documents');
      setDocuments(res.data);
      setError('');
    } catch (err) {
      setError(t('erreur_chargement'));
    }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get('/api/services');
      setServices(res.data);
    } catch (err) {
      setError(t('erreur_chargement'));
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm(t('confirmation_archiver'))) return;
    try {
      await axios.put(`/api/courriers/archiver/${id}`);
      setSuccess(t('archivage_succes'));
      fetchDocuments();
    } catch (err) {
      setError(getErrorMessage(err, t('erreur_archivage')));
    }
  };

  const openTransferModal = (doc) => {
    setSelectedDoc(doc);
    setUsers([]);
    setTransferForm({ serviceId: '', userId: '', doitRevenir: false, message: '' });
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleServiceChange = async (serviceId) => {
  const nextServiceId = serviceId || '';
  setTransferForm({ ...transferForm, serviceId: nextServiceId, userId: '' });
  setUsers([]);
  if (!nextServiceId) return;
  try {
    const res = await axios.get(`/api/utilisateurs?serviceId=${nextServiceId}`);
    setUsers(res.data);
  } catch (err) {
    setError(t('erreur_chargement'));
  }
};

  const handleTransfer = async () => {
    if (!selectedDoc || !transferForm.serviceId) {
      setError(t('service_destinataire_requis'));
      return;
    }
    try {
      await axios.post('/api/transactions', {
        documentId: selectedDoc.idEntite,
        documentType: selectedDoc.type,
        destinationServiceId: Number(transferForm.serviceId),
        destinationUserId: transferForm.userId ? Number(transferForm.userId) : null,
        doitRevenir: transferForm.doitRevenir,
        message: transferForm.message,
      });
      setShowModal(false);
      setSelectedDoc(null);
      setSuccess(t('transaction_envoyee'));
      fetchDocuments();
    } catch (err) {
      setError(err.response?.data?.message || t('erreur_transaction'));
    }
  };

  const handleConsult = async (doc) => {
    try {
      const res = await axios.get(`/api/documents/${doc.idEntite}?type=${encodeURIComponent(doc.type)}`);
      setModalDocument(res.data);
    } catch (err) {
      setModalDocument(doc);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalDocument(null);
  };

  // Pagination logic
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const currentDocuments = documents.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(documents.length / rowsPerPage);
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  return (
    <div className="page-container">
      <h1 className="page-title">{t('mes_entites')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      <div className="data-table-wrapper">
        <h3>{t('documents_transmissibles')} ({documents.length})</h3>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <span>{t('afficher')}</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
          <span>{t('lignes')}</span>
        </div>

        <table className="modern-table">
          <thead>
            <tr>
              <th>{t('titre')}</th>
              <th>{t('type')}</th>
              <th>{t('date')}</th>
              <th>{t('source')}</th>
              <th>{t('destinataire')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {currentDocuments.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center' }}>{t('aucun_document')}</td>
              </tr>
            ) : (
              currentDocuments.map((doc) => (
                <tr key={`${doc.idEntite}_${doc.type}`}>
                  <td>{doc.sujet || '-'}</td>
                  <td>{doc.type}</td>
                  <td>{doc.dateCreation ? new Date(doc.dateCreation).toLocaleString('ar-MA') : '-'}</td>
                  <td>{doc.source || '-'}</td>
                  <td>{doc.destinataire || '-'}</td>
                  <td className="action-icons">
                    <button onClick={() => handleConsult(doc)}>{t('consulter')}</button>
                    <button onClick={() => openTransferModal(doc)}>{t('transferer')}</button>
                    <button onClick={() => handleArchive(doc.idEntite)}>{t('archiver')}</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
              {t('precedent')}
            </button>
            <span>{t('page')} {currentPage} / {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
              {t('suivant')}
            </button>
          </div>
        )}
      </div>

      {showModal && selectedDoc && (
        <>
          <div className="modal-overlay" onClick={() => setShowModal(false)} />
          <div className="modal">
            <h3>{t('transferer')} : {selectedDoc.sujet}</h3>
            <div className="form-grid">
              <div className="form-field">
                <label>{t('service_destinataire')} *</label>
                <select
                  value={transferForm.serviceId}
                  onChange={(e) => handleServiceChange(Number(e.target.value))}
                >
                  <option value="">--</option>
                  {services
                    .filter((s) => s.idService !== selectedDoc.idService)
                    .map((s) => (
                      <option key={s.idService} value={s.idService}>
                        {s.nomService}
                      </option>
                    ))}
                </select>
              </div>
              <div className="form-field">
                <label>{t('personne')}</label>
                <select
                  value={transferForm.userId}
                  onChange={(e) => setTransferForm({ ...transferForm, userId: e.target.value })}
                >
                  <option value="">--</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nomComplet}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={transferForm.doitRevenir}
                    onChange={(e) => setTransferForm({ ...transferForm, doitRevenir: e.target.checked })}
                  />
                  {t('doit_revenir')}
                </label>
              </div>
              <div className="form-field full-width">
                <label>{t('message')}</label>
                <textarea
                  value={transferForm.message}
                  onChange={(e) => setTransferForm({ ...transferForm, message: e.target.value })}
                  rows="3"
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleTransfer}>
                {t('envoyer')}
              </button>
              <button className="btn-secondary" onClick={() => setShowModal(false)}>
                {t('annuler')}
              </button>
            </div>
          </div>
        </>
      )}

      {isModalOpen && modalDocument && <DocumentModal document={modalDocument} onClose={closeModal} />}
    </div>
  );
}

function getErrorMessage(error, fallback) {
  if (typeof error.response?.data === 'string') return error.response.data;
  if (error.response?.data?.message) return error.response.data.message;
  if (error.message) return error.message;
  return fallback;
}

export default MesEntites;