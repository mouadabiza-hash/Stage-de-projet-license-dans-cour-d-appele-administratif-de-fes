import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';
import { useModal } from '../context/ModalContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import DocumentModal from '../components/DocumentModal';
import SearchableSelect from './SearchableSelect';

function MesEntites() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const perms = usePermissions();
  const { user } = useAuth();
  const { showConfirm } = useModal();
  const { showToast } = useToast();
  const { confirm, ConfirmModalComponent } = useConfirm();
  const serviceId = user?.idService;

  const [allDocuments, setAllDocuments] = useState([]);
  const [services, setServices] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [hiddenIds, setHiddenIds] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAllOwn, setSelectAllOwn] = useState(false);
  const [selectAllSub, setSelectAllSub] = useState(false);
  const [showHiddenModal, setShowHiddenModal] = useState(false);

  // Transfer states
  const [showTransferChoice, setShowTransferChoice] = useState(false);
  const [transferChoiceDoc, setTransferChoiceDoc] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [bulkTransferDocs, setBulkTransferDocs] = useState([]);
  const [transferSelections, setTransferSelections] = useState([]);
  const [transferCurrentService, setTransferCurrentService] = useState('');
  const [transferCurrentUserIds, setTransferCurrentUserIds] = useState([]);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferDoitRevenir, setTransferDoitRevenir] = useState(false);
  const [showSingleTransferModal, setShowSingleTransferModal] = useState(false);
  const [singleTransferTarget, setSingleTransferTarget] = useState(null);
  const [singleTransferServiceId, setSingleTransferServiceId] = useState('');
  const [singleTransferUsers, setSingleTransferUsers] = useState([]);
  const [singleTransferUserId, setSingleTransferUserId] = useState('');
  const [singleTransferDoitRevenir, setSingleTransferDoitRevenir] = useState(false);
  const [singleTransferMessage, setSingleTransferMessage] = useState('');
  const [singleTransferDocType, setSingleTransferDocType] = useState('Judiciaire');

  // Add / Edit modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formMode, setFormMode] = useState('file');
  const [editOnlyNumeroDossier, setEditOnlyNumeroDossier] = useState(false);
  const [formData, setFormData] = useState({
    numeroDossier: '', tribunalSource: '', sujet: '', date: new Date().toISOString().slice(0, 10),
    description: '', lienPdf: '', numeroPremiereInstance: '', etat: 'Nouveau',
    parentJudiciaireId: '', typeJudiciaire: '', linkedDocumentType: '', linkedDocumentSource: ''
  });
  const [parentFiles, setParentFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Dynamic lists
  const [documentStates, setDocumentStates] = useState([]);
  const [tribunalTypes, setTribunalTypes] = useState([]);
  const [judicialTypes, setJudicialTypes] = useState([]);
  const [linkedDocTypes, setLinkedDocTypes] = useState([]);
  const [linkedDocSourceOptions, setLinkedDocSourceOptions] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDocument, setModalDocument] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [rowsPerPageOwn, setRowsPerPageOwn] = useState(10);
  const [currentPageOwn, setCurrentPageOwn] = useState(1);
  const [rowsPerPageSub, setRowsPerPageSub] = useState(10);
  const [currentPageSub, setCurrentPageSub] = useState(1);

  // Memoized options
  const tribunalOptions = useMemo(() => 
    tribunalTypes.map(tt => ({ value: tt.code, label: locale === 'ar' ? tt.valueAr : tt.valueFr })), [tribunalTypes, locale]);
  const etatOptions = useMemo(() => 
    documentStates.map(s => ({ value: s.code, label: locale === 'ar' ? s.valueAr : s.valueFr })), [documentStates, locale]);
  const judicialTypeOptions = useMemo(() => 
    judicialTypes.map(jt => ({ value: jt.code, label: locale === 'ar' ? jt.valueAr : jt.valueFr })), [judicialTypes, locale]);
  const linkedDocOptions = useMemo(() => 
    linkedDocTypes.map(ld => ({ value: ld.code, label: locale === 'ar' ? ld.valueAr : ld.valueFr })), [linkedDocTypes, locale]);
  const linkedDocSourceOpts = useMemo(() => 
    linkedDocSourceOptions.map(ls => ({ value: ls.code, label: locale === 'ar' ? ls.valueAr : ls.valueFr })), [linkedDocSourceOptions, locale]);

  // Fetch lists
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const [statesRes, tribunalRes, judicialRes, linkedDocRes, linkedDocSourceRes] = await Promise.all([
          axios.get('/api/ListItems?listName=DocumentState'),
          axios.get('/api/ListItems?listName=TribunalType'),
          axios.get('/api/ListItems?listName=JudicialType'),
          axios.get('/api/ListItems?listName=LinkedDocumentType'),
          axios.get('/api/ListItems?listName=LinkedDocumentSource')
        ]);
        setDocumentStates(statesRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setTribunalTypes(tribunalRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setJudicialTypes(judicialRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setLinkedDocTypes(linkedDocRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
        setLinkedDocSourceOptions(linkedDocSourceRes.data.sort((a, b) => a.displayOrder - b.displayOrder));
      } catch (err) { console.error(err); setError(t('erreur_chargement_donnees')); }
    };
    fetchLists();
  }, []);

  // Hidden documents
  useEffect(() => {
    const stored = localStorage.getItem('hiddenMesEntites');
    if (stored) setHiddenIds(JSON.parse(stored));
  }, []);

  // Fetch main data
  useEffect(() => { fetchDocuments(); fetchServices(); fetchAllUsers(); }, []);

  const visibleDocuments = useMemo(() => {
    return allDocuments.filter(doc => !hiddenIds.includes(`${doc.idEntite}_${doc.type || doc.Type}`));
  }, [allDocuments, hiddenIds]);

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return visibleDocuments;
    const term = searchTerm.toLowerCase();
    return visibleDocuments.filter(doc =>
      (doc.sujet || '').toLowerCase().includes(term) ||
      (doc.source || '').toLowerCase().includes(term) ||
      (doc.destinataire || '').toLowerCase().includes(term) ||
      (doc.type || '').toLowerCase().includes(term) ||
      (doc.numeroCourrier || '').toLowerCase().includes(term)
    );
  }, [visibleDocuments, searchTerm]);

  const ownDocuments = useMemo(() => filteredDocuments.filter(d => !d.isSubstitute), [filteredDocuments]);
  const subDocuments = useMemo(() => filteredDocuments.filter(d => d.isSubstitute), [filteredDocuments]);

  useEffect(() => { setCurrentPageOwn(1); }, [ownDocuments.length]);
  useEffect(() => { setCurrentPageSub(1); }, [subDocuments.length]);

  const fetchDocuments = async () => {
    try { 
      const res = await axios.get('/api/documents'); 
      setAllDocuments(res.data); 
      setError(''); 
    } catch (err) { 
      setError(t('erreur_chargement')); 
      console.error('fetchDocuments error', err);
    }
  };
  const fetchServices = async () => {
    try { const res = await axios.get('/api/services'); setServices(res.data); } catch {}
  };
  const fetchAllUsers = async () => {
    try { const res = await axios.get('/api/utilisateurs'); setAllUsers(res.data); } catch {}
  };
  const fetchParents = async () => {
    try { const res = await axios.get('/api/acteursjudiciaires/parents'); setParentFiles(res.data); } 
    catch { setError(t('erreur_chargement_parents')); }
  };

  const handleHide = (doc) => {
    const key = `${doc.idEntite}_${doc.type || doc.Type}`;
    setHiddenIds([...hiddenIds, key]);
    localStorage.setItem('hiddenMesEntites', JSON.stringify([...hiddenIds, key]));
    setSelectedIds(prev => prev.filter(id => id !== key));
  };

  const handleBulkHide = (docs) => {
    const newHidden = [...hiddenIds];
    docs.forEach(doc => {
      const key = `${doc.idEntite}_${doc.type || doc.Type}`;
      if (!newHidden.includes(key)) newHidden.push(key);
    });
    setHiddenIds(newHidden);
    localStorage.setItem('hiddenMesEntites', JSON.stringify(newHidden));
    setSelectedIds(prev => prev.filter(id => !docs.map(d => `${d.idEntite}_${d.type || d.Type}`).includes(id)));
    setSuccess(t('documents_masques') || 'Documents masqués');
  };

  const handleRestore = (key) => {
    const newHidden = hiddenIds.filter(id => id !== key);
    setHiddenIds(newHidden);
    localStorage.setItem('hiddenMesEntites', JSON.stringify(newHidden));
  };

  // ========== FONCTION ARCHIVAGE CORRIGÉE ==========
  const handleArchive = async (doc) => {
    console.log('🔍 handleArchive appelé', doc);
    
    if (!perms.canArchive) {
      showToast(t('access_denied') || 'Vous n\'avez pas les droits pour archiver', 'error');
      return;
    }
    
    // Utiliser confirm de useConfirm
    const confirmed = await confirm(
      t('confirmation_archiver') || 'Voulez-vous vraiment archiver ce document ?',
      { 
        title: t('attention') || 'Attention', 
        confirmText: t('archiver') || 'Archiver',
        cancelText: t('annuler') || 'Annuler'
      }
    );
    
    console.log('🔍 Confirmé:', confirmed);
    
    if (!confirmed) return;
    
    const docType = doc.type || doc.Type;
    const docId = doc.idEntite;
    
    console.log('🔍 Archivage:', { docId, docType });
    
    try {
      if (docType === 'Administratif') {
        await axios.put(`/api/courriers/archiver/${docId}`);
      } else {
        await axios.put(`/api/acteursjudiciaires/archiver/${docId}`);
      }
      
      showToast(t('archivage_succes') || 'Document archivé avec succès', 'success');
      await fetchDocuments();
    } catch (err) {
      console.error('❌ Erreur archivage:', err);
      const errorMsg = err.response?.data || t('erreur_archivage') || 'Erreur lors de l\'archivage';
      showToast(errorMsg, 'error');
    }
  };

  // ========== FONCTION BULK ARCHIVE CORRIGÉE ==========
  const handleBulkArchive = async (docs) => {
    if (!perms.canArchive) {
      showToast(t('access_denied') || 'Vous n\'avez pas les droits pour archiver', 'error');
      return;
    }
    
    if (docs.length === 0) {
      showToast(t('selection_requise') || 'Veuillez sélectionner au moins un document', 'warning');
      return;
    }
    
    const confirmed = await confirm(
      `${t('confirmation_archiver')} (${docs.length} documents)`,
      { 
        title: t('attention') || 'Attention', 
        confirmText: t('archiver') || 'Archiver',
        cancelText: t('annuler') || 'Annuler'
      }
    );
    
    if (!confirmed) return;
    
    let ok = 0;
    let fail = 0;
    const errors = [];
    
    for (let doc of docs) {
      try {
        if ((doc.type || doc.Type) === 'Administratif') {
          await axios.put(`/api/courriers/archiver/${doc.idEntite}`);
        } else {
          await axios.put(`/api/acteursjudiciaires/archiver/${doc.idEntite}`);
        }
        ok++;
      } catch (err) {
        fail++;
        errors.push(`${doc.sujet || doc.idEntite}: ${err.response?.data || err.message}`);
      }
    }
    
    let message = `✅ ${ok} ${t('archives_succes') || 'document(s) archivé(s)'}`;
    if (fail > 0) {
      message += `\n\n⚠️ ${fail} échec(s):\n${errors.join('\n')}`;
      showToast(message, 'warning');
    } else {
      showToast(message, 'success');
    }
    
    await fetchDocuments();
  };

  const openAddModal = () => {
    setEditingDoc(null);
    const isProcedures = user?.role === 'Procedures';
    const isEnregistrement = user?.role === 'Enregistrement';
    let defaultMode = 'file';
    if (isProcedures) defaultMode = 'linked';
    if (isEnregistrement) defaultMode = 'file';
    setFormMode(defaultMode);
    setEditOnlyNumeroDossier(false);
    setFormData({
      numeroDossier: '', tribunalSource: '', sujet: '', date: new Date().toISOString().slice(0, 10),
      description: '', lienPdf: '', numeroPremiereInstance: '', etat: 'Nouveau',
      parentJudiciaireId: '', typeJudiciaire: '', linkedDocumentType: '', linkedDocumentSource: ''
    });
    if (defaultMode === 'linked') fetchParents();
    setFormError(''); setFormSuccess('');
    setShowFormModal(true);
  };

  const openEditModal = (doc) => {
    if (doc.type !== 'Judiciaire') return;
    if (user?.role === 'Procedures') return;

    setEditingDoc(doc);
    const isLinked = doc.estDocumentLie === true;
    setFormMode(isLinked ? 'linked' : 'file');
    
    const isEnregistrement = user?.role === 'Enregistrement';
    setEditOnlyNumeroDossier(isEnregistrement);
    
    setFormData({
      numeroDossier: doc.numeroDossierJudiciaire || '',
      tribunalSource: doc.source || '',
      sujet: doc.sujet || '',
      date: doc.dateCreation ? doc.dateCreation.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: doc.description || '',
      lienPdf: doc.lienPdf || '',
      numeroPremiereInstance: doc.numeroPremiereInstance || '',
      etat: doc.etatArchive || 'Nouveau',
      parentJudiciaireId: doc.parentJudiciaireId || '',
      typeJudiciaire: doc.typeJudiciaire || '',
      linkedDocumentType: doc.linkedDocumentType || '',
      linkedDocumentSource: doc.linkedDocumentSource || ''
    });
    if (isLinked) fetchParents();
    setFormError(''); setFormSuccess('');
    setShowFormModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFormUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    setUploadingFile(true);
    try {
      const res = await axios.post('/api/acteursjudiciaires/upload-pdf', fd);
      setFormData(prev => ({ ...prev, lienPdf: res.data.lienPdf }));
      setFormSuccess(t('document_uploaded'));
      setTimeout(() => setFormSuccess(''), 3000);
    } catch (err) { setFormError(getErrorMessage(err, t('erreur_upload'))); }
    finally { setUploadingFile(false); e.target.value = ''; }
  };

  const submitForm = async () => {
    setFormError('');
    
    if (editOnlyNumeroDossier && editingDoc) {
      if (!formData.numeroDossier) {
        setFormError(t('numero_dossier_obligatoire') || 'رقم الاستئنافي مطلوب');
        return;
      }
      const fullPayload = {
        idBureauOrdre: editingDoc.idBureauOrdre || null,
        date: editingDoc.dateArchivage || editingDoc.date || new Date().toISOString(),
        tribunalSource: editingDoc.tribunalSource || editingDoc.source || '',
        sujet: editingDoc.sujet || '',
        description: editingDoc.description || '',
        etatArchive: editingDoc.etatArchive || editingDoc.etat || 'Nouveau',
        lienPdf: editingDoc.lienPdf || '',
        idService: editingDoc.idService,
        estTransmissible: editingDoc.estTransmissible !== undefined ? editingDoc.estTransmissible : true,
        numeroPremiereInstance: editingDoc.numeroPremiereInstance || null,
        estDocumentLie: editingDoc.estDocumentLie || false,
        parentJudiciaireId: editingDoc.parentJudiciaireId || null,
        destinataire: editingDoc.destinataire || 'محكمة الاستئناف',
        numeroDossier: formData.numeroDossier,
        typeJudiciaire: editingDoc.typeJudiciaire || null,
        linkedDocumentType: editingDoc.linkedDocumentType || null,
        linkedDocumentSource: editingDoc.linkedDocumentSource || null,
      };
      try {
        await axios.put(`/api/acteursjudiciaires/${editingDoc.idEntite}`, fullPayload);
        setFormSuccess(t('modification_succes'));
        setTimeout(() => { setShowFormModal(false); fetchDocuments(); }, 1500);
      } catch (err) {
        setFormError(getErrorMessage(err, t('erreur_enregistrement')));
      }
      return;
    }
    
    if (!formData.sujet || !formData.date) {
      setFormError(t('champs_obligatoires'));
      return;
    }
    if (formMode === 'file' && !formData.tribunalSource) {
      setFormError(t('tribunal_source_requis'));
      return;
    }
    if (formMode === 'linked' && !formData.parentJudiciaireId) {
      setFormError(t('parent_requis'));
      return;
    }

    const payload = {
      date: new Date(formData.date).toISOString(),
      tribunalSource: formMode === 'file' ? formData.tribunalSource : '',
      sujet: formData.sujet,
      direction: 'Entrant',
      description: formData.description,
      etatArchive: formData.etat,
      lienPdf: formData.lienPdf,
      idService: serviceId,
      estTransmissible: true,
      numeroPremiereInstance: formData.numeroPremiereInstance || null,
      estDocumentLie: formMode === 'linked',
      parentJudiciaireId: formMode === 'linked' ? Number(formData.parentJudiciaireId) : null,
      destinataire: 'محكمة الاستئناف',
      numeroDossier: formMode === 'file' ? formData.numeroDossier : null,
      typeJudiciaire: formMode === 'file' ? formData.typeJudiciaire : null,
      linkedDocumentType: formMode === 'linked' ? formData.linkedDocumentType : null,
      linkedDocumentSource: formMode === 'linked' ? formData.linkedDocumentSource : null,
    };

    try {
      if (editingDoc) {
        await axios.put(`/api/acteursjudiciaires/${editingDoc.idEntite}`, payload);
      } else {
        await axios.post('/api/acteursjudiciaires', payload);
      }
      setFormSuccess(editingDoc ? t('modification_succes') : t('ajout_succes'));
      setTimeout(() => { setShowFormModal(false); fetchDocuments(); }, 1500);
    } catch (err) {
      setFormError(getErrorMessage(err, t('erreur_enregistrement')));
    }
  };

  const handleSelectAll = (docs, setSelectAllFn, selectAllState) => {
    if (selectAllState) {
      setSelectedIds(prev => prev.filter(id => !docs.map(d => `${d.idEntite}_${d.type || d.Type}`).includes(id)));
    } else {
      const newIds = docs.map(d => `${d.idEntite}_${d.type || d.Type}`);
      setSelectedIds(prev => [...new Set([...prev, ...newIds])]);
    }
    setSelectAllFn(!selectAllState);
  };

  const handleSelectOne = (doc) => {
    const key = `${doc.idEntite}_${doc.type || doc.Type}`;
    setSelectedIds(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const getSelectedDocs = (docs) => docs.filter(d => selectedIds.includes(`${d.idEntite}_${d.type || d.Type}`));

  // Transfer functions
  const openTransferModal = (doc) => {
    setTransferTarget(doc);
    setBulkTransferDocs([]);
    setTransferSelections([]);
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
    setTransferMessage('');
    setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };

  const openSingleTransferModal = (doc, isJudicial) => {
    setSingleTransferTarget(doc);
    setSingleTransferDocType(isJudicial ? 'Judiciaire' : 'Administratif');
    setSingleTransferServiceId('');
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    setSingleTransferDoitRevenir(false);
    setSingleTransferMessage('');
    setShowSingleTransferModal(true);
  };

  const handleSingleServiceChange = async (svcId) => {
    setSingleTransferServiceId(svcId);
    setSingleTransferUsers([]);
    setSingleTransferUserId('');
    if (!svcId) return;
    try {
      const res = await axios.get(`/api/utilisateurs?serviceId=${svcId}`);
      setSingleTransferUsers(res.data);
    } catch (err) { setError(t('erreur_chargement')); }
  };

  const handleSingleTransfer = async () => {
    if (!singleTransferTarget || !singleTransferUserId) {
      setError(t('selection_requise'));
      return;
    }
    try {
      await axios.post('/api/transactions', {
        documentId: singleTransferTarget.idEntite,
        documentType: singleTransferDocType,
        destinationServiceId: null,
        destinationUserId: Number(singleTransferUserId),
        doitRevenir: singleTransferDoitRevenir,
        message: singleTransferMessage
      });
      setSuccess(t('transaction_envoyee'));
      setShowSingleTransferModal(false);
      fetchDocuments();
    } catch (err) { setError(err.response?.data || t('erreur_transaction')); }
  };

  const openTransferChoice = (doc) => {
    setTransferChoiceDoc(doc);
    setShowTransferChoice(true);
  };

  const handleTransferChoice = (mode) => {
    setShowTransferChoice(false);
    if (mode === 'single') openSingleTransferModal(transferChoiceDoc, false);
    else openTransferModal(transferChoiceDoc);
  };

  const handleTransferServiceChange = (svcId) => {
    setTransferCurrentService(svcId);
    setTransferCurrentUserIds([]);
  };

  const toggleCurrentUser = (userId) => {
    setTransferCurrentUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const addCurrentSelection = () => {
    if (!transferCurrentService || transferCurrentUserIds.length === 0) return;
    setTransferSelections(prev => {
      const existing = prev.find(s => s.serviceId === transferCurrentService);
      if (existing) {
        return prev.map(s => s.serviceId === transferCurrentService
          ? { ...s, userIds: [...new Set([...s.userIds, ...transferCurrentUserIds])] }
          : s);
      }
      return [...prev, { serviceId: transferCurrentService, userIds: [...transferCurrentUserIds] }];
    });
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
  };

  const removeSelection = (serviceId) => {
    setTransferSelections(prev => prev.filter(s => s.serviceId !== serviceId));
  };

  const handleMultiTransfer = async () => {
    const allUserIds = transferSelections.flatMap(s => s.userIds);
    const docs = bulkTransferDocs.length > 0 ? bulkTransferDocs : (transferTarget ? [transferTarget] : []);
    if (allUserIds.length === 0 || docs.length === 0) {
      setError(t('selection_requise'));
      return;
    }
    try {
      for (let doc of docs) {
        await axios.post('/api/transactions/batch', {
          documentId: doc.idEntite,
          documentType: doc.type || doc.Type,
          destinationUserIds: allUserIds,
          doitRevenir: transferDoitRevenir,
          message: transferMessage
        });
      }
      setSuccess(t('transaction_envoyee'));
      setShowTransferModal(false);
      fetchDocuments();
    } catch (err) {
      console.error('Batch transfer error:', err);
      setError(err.response?.data?.message || t('erreur_transaction'));
    }
  };

  const openBulkTransferModal = (docs) => {
    if (docs.length === 0) return;
    setTransferTarget(null);
    setBulkTransferDocs(docs);
    setTransferSelections([]);
    setTransferCurrentService('');
    setTransferCurrentUserIds([]);
    setTransferMessage('');
    setTransferDoitRevenir(false);
    setShowTransferModal(true);
  };

  const handleConsult = async (doc) => {
    try {
      const res = await axios.get(`/api/documents/${doc.idEntite}?type=${encodeURIComponent(doc.type || doc.Type)}`);
      setModalDocument(res.data);
    } catch { setModalDocument(doc); }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setModalDocument(null); };

  const shouldShowTransferButton = (doc) => {
    if (!doc.estTransmissible) return false;
    const isJudicialMain = doc.type === 'Judiciaire' && !doc.estDocumentLie;
    if (isJudicialMain) return true;
    return !doc.hasTransaction;
  };

  const renderTable = (title, documents, selectAll, setSelectAllFn, rowsPerPage, currentPage, setCurrentPageFn, setRowsPerPageFn) => {
    const idxLast = currentPage * rowsPerPage;
    const idxFirst = idxLast - rowsPerPage;
    const currentDocs = documents.slice(idxFirst, idxLast);
    const totalPages = Math.ceil(documents.length / rowsPerPage);
    const selectedDocs = getSelectedDocs(documents);
    return (
      <div className="data-table-wrapper" style={{ marginBottom: '2rem' }}>
        <h3>{title} ({documents.length})</h3>
        <div className="bulk-toolbar">
          <div className="bulk-toolbar-left"><span className="bulk-count">{selectedDocs.length} {t('selected')}</span></div>
          <div className="bulk-toolbar-right">
            {perms.canTransfer && (
              <button className="btn-primary" disabled={selectedDocs.length===0} onClick={()=>openBulkTransferModal(selectedDocs)}>
                {t('transferer_selection')}
              </button>
            )}
            {perms.canArchive && (
              <button className="btn-primary" disabled={selectedDocs.length===0} onClick={()=>handleBulkArchive(selectedDocs)}>
                {t('archiver_selection')}
              </button>
            )}
            <button className="btn-primary" disabled={selectedDocs.length===0} onClick={()=>handleBulkHide(selectedDocs)}>
              {t('masquer_selection') || 'Masquer la sélection'}
            </button>
          </div>
        </div>
        <div style={{display:'flex', justifyContent:'flex-end', marginBottom:'0.5rem'}}>
          <div className="rows-per-page">
            <span>{t('afficher')}</span>
            <select value={rowsPerPage} onChange={e=>{setRowsPerPageFn(Number(e.target.value)); setCurrentPageFn(1);}}>
              <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
            </select>
            <span>{t('lignes')}</span>
          </div>
        </div>
        <table className="modern-table" style={{ fontSize: '0.95rem', width: '100%' }}>
          <thead>
            <tr>
              <th style={{width:40}}><input type="checkbox" checked={selectAll} onChange={()=>handleSelectAll(documents, setSelectAllFn, selectAll)}/></th>
              <th>{t('titre')}</th>
              <th>{t('numero_dossier_judiciaire')}</th>
              <th>{t('type')}</th>
              <th>{t('date')}</th>
              <th>{t('source')}</th>
              <th>{t('destinataire')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {currentDocs.length === 0 ? (
              <tr><td colSpan="8" className="text-muted">{t('aucun_document')}</td> </tr>
            ) : (
              currentDocs.map(doc => {
                const key = `${doc.idEntite}_${doc.type || doc.Type}`;
                const isJudicial = doc.type === 'Judiciaire';
                const isLinked = doc.estDocumentLie === true;
                const canArchive = perms.canArchive && isJudicial && !isLinked;
                const showTransfer = shouldShowTransferButton(doc);
                const canTransfer = showTransfer && perms.canTransfer;
                const showEdit = isJudicial && perms.canCreateJuridique && user?.role !== 'Procedures';
                const isEnregistrement = user?.role === 'Enregistrement';
                return (
                  <tr key={key}>
                    <td><input type="checkbox" checked={selectedIds.includes(key)} onChange={()=>handleSelectOne(doc)}/></td>
                    <td>{doc.sujet || '-'}</td>
                    <td>{doc.numeroDossierJudiciaire || '-'}</td>
                    <td>{isJudicial ? (isLinked ? t('judiciaire_linked') : t('judiciaire_file')) : (doc.type || '-')}</td>
                    <td>{doc.dateCreation ? new Date(doc.dateCreation).toLocaleDateString(locale) : '-'}</td>
                    <td>{doc.source || '-'}</td>
                    <td>{doc.destinataire || '-'}</td>
                    <td className="action-icons">
                      <button onClick={()=>handleConsult(doc)}>{t('consulter')}</button>
                      {showEdit && (
                        isEnregistrement ? (
                          <button onClick={()=>openEditModal(doc)} className="action-btn action-btn-warning">
                            {t('ajouter_numero_appel') || 'إضافة رقم الاستئنافي'}
                          </button>
                        ) : (
                          <button onClick={()=>openEditModal(doc)}>{t('modifier')}</button>
                        )
                      )}
                      {canTransfer && perms.canTransfer && (
                        isJudicial && !isLinked ? 
                          <button onClick={() => openSingleTransferModal(doc, true)}>{t('transferer')}</button> :
                          <button onClick={() => openTransferChoice(doc)}>{t('transferer')}</button>
                      )}
                      <button onClick={() => handleHide(doc)}>{t('masquer')}</button>
                      {canArchive && (
                        <button 
                          className="action-btn action-btn-warning" 
                          onClick={() => handleArchive(doc)}
                        >
                          {t('archiver')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages>1 && (
          <div className="pagination">
            <button onClick={()=>setCurrentPageFn(currentPage-1)} disabled={currentPage===1}>{t('precedent')}</button>
            <span>{t('page')} {currentPage} / {totalPages}</span>
            <button onClick={()=>setCurrentPageFn(currentPage+1)} disabled={currentPage===totalPages}>{t('suivant')}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <ConfirmModalComponent />
      
      <h1 className="page-title">{t('mes_entites')}</h1>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <div className="filters">
        {(user?.role === 'Admin' || user?.role === 'Enregistrement' || user?.role === 'Procedures') && (
          <button className="btn-primary" onClick={openAddModal}>+ {t('add_document')}</button>
        )}
        <input type="text" placeholder={t('rechercher_document')} value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{flex:1, minWidth:'250px'}}/>
        {searchTerm && <button className="btn-secondary" onClick={()=>setSearchTerm('')}>{t('reinitialiser')}</button>}
        <button className="btn-secondary" onClick={() => setShowHiddenModal(true)}>
          📂 {t('hidden_documents') || 'الوثائق المخفية'} ({hiddenIds.length})
        </button>
      </div>
      
      {renderTable(t('my_documents'), ownDocuments, selectAllOwn, setSelectAllOwn, rowsPerPageOwn, currentPageOwn, setCurrentPageOwn, setRowsPerPageOwn)}
      {subDocuments.length > 0 && renderTable(t('substitute_documents'), subDocuments, selectAllSub, setSelectAllSub, rowsPerPageSub, currentPageSub, setCurrentPageSub, setRowsPerPageSub)}

      {/* Add / Edit Modal */}
      {showFormModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'700px', maxHeight:'85vh', overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{editingDoc ? t('modifier_document') : t('ajouter_document_judiciaire')}</h3>
              <button className="btn-secondary" onClick={()=>setShowFormModal(false)}>{t('fermer')}</button>
            </div>
            {!editingDoc && (
              <div className="registry-choice sub-choice" style={{marginBottom:'1rem'}}>
                {perms.canCreateJuridique && user?.role !== 'Procedures' && (
                  <button type="button" className={`choice-pill ${formMode==='file'?'active':''}`} onClick={()=>{setFormMode('file'); setFormData(prev=>({...prev, tribunalSource:'', parentJudiciaireId:''}));}}>{t('judiciaire_file')}</button>
                )}
                {perms.canCreateLinked && (
                  <button type="button" className={`choice-pill ${formMode==='linked'?'active':''}`} onClick={()=>{setFormMode('linked'); fetchParents(); setFormData(prev=>({...prev, tribunalSource:'', parentJudiciaireId:''}));}}>{t('judiciaire_linked')}</button>
                )}
              </div>
            )}
            <div className="form-grid">
              {editOnlyNumeroDossier && editingDoc ? (
                <div className="form-field full-width">
                  <label>{t('numero_dossier_judiciaire') || 'رقم الاستئنافي'}</label>
                  <input type="text" name="numeroDossier" value={formData.numeroDossier} onChange={handleFormChange} placeholder="2026/15/3" className="form-input" />
                  <small>{t('only_editable_field') || 'هذا الحقل فقط قابل للتعديل'}</small>
                </div>
              ) : (
                <>
                  {formMode === 'file' && (
                    <>
                      <div className="form-field">
                        <label>{t('numero_dossier_judiciaire') || 'رقم الاستئنافي'}</label>
                        <input type="text" name="numeroDossier" value={formData.numeroDossier} onChange={handleFormChange} placeholder="2026/15/3" className="form-input" />
                      </div>
                      <div className="form-field">
                        <label>{t('type_judiciaire') || 'نوع الملف'}</label>
                        <SearchableSelect
                          name="typeJudiciaire"
                          value={formData.typeJudiciaire}
                          onChange={handleFormChange}
                          options={judicialTypeOptions}
                          placeholder={t('choisir_ou_ecrire')}
                        />
                      </div>
                      <div className="form-field">
                        <label>{t('tribunal_source')} *</label>
                        <SearchableSelect
                          name="tribunalSource"
                          value={formData.tribunalSource}
                          onChange={handleFormChange}
                          options={tribunalOptions}
                          placeholder={t('choisir_ou_ecrire')}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label>{t('numero_premiere_instance') || 'الرقم الابتدائي'}</label>
                        <input type="text" name="numeroPremiereInstance" value={formData.numeroPremiereInstance} onChange={handleFormChange} placeholder="2026/12" className="form-input" />
                      </div>
                    </>
                  )}
                  {formMode === 'linked' && (
                    <>
                      <div className="form-field">
                        <label>{t('choisir_dossier_parent')} *</label>
                        <select name="parentJudiciaireId" value={formData.parentJudiciaireId} onChange={handleFormChange} required>
                          <option value="">-- {t('choisir')} --</option>
                          {parentFiles.map(p => <option key={p.id} value={p.id}>{p.numeroDossier}</option>)}
                        </select>
                      </div>
                      <div className="form-field">
                        <label>{t('linked_document_source') || 'مصدر الوثيقة'} *</label>
                        <SearchableSelect
                          name="linkedDocumentSource"
                          value={formData.linkedDocumentSource}
                          onChange={handleFormChange}
                          options={linkedDocSourceOpts}
                          placeholder={t('choisir_ou_ecrire')}
                          required
                        />
                      </div>
                      <div className="form-field">
                        <label>{t('linked_document_type') || 'نوع الوثيقة'}</label>
                        <SearchableSelect
                          name="linkedDocumentType"
                          value={formData.linkedDocumentType}
                          onChange={handleFormChange}
                          options={linkedDocOptions}
                          placeholder={t('choisir_ou_ecrire')}
                        />
                      </div>
                    </>
                  )}
                  <div className="form-field"><label>{t('date')} *</label><input type="date" name="date" value={formData.date} onChange={handleFormChange} required className="form-input" /></div>
                  <div className="form-field"><label>{t('objet')} *</label><input type="text" name="sujet" value={formData.sujet} onChange={handleFormChange} required className="form-input" /></div>
                  <div className="form-field"><label>{t('etat')}</label><SearchableSelect
                      name="etat"
                      value={formData.etat}
                      onChange={handleFormChange}
                      options={etatOptions}
                      placeholder={t('choisir_ou_ecrire')}
                    /></div>
                  <div className="form-field full-width"><label>{t('document_pdf_word')}</label><div className="document-control"><label className="document-upload-button">{uploadingFile ? t('uploading') : t('choisir_fichier')}<input type="file" accept=".pdf,.doc,.docx" onChange={handleFormUpload} /></label><div className={formData.lienPdf ? "document-link-preview filled" : "document-link-preview"}><span>{formData.lienPdf ? getDocumentName(formData.lienPdf) : t('aucun_fichier')}</span>{formData.lienPdf && <a href={getDocumentHref(formData.lienPdf)} target="_blank" rel="noreferrer">{t('ouvrir')}</a>}</div></div></div>
                  <div className="form-field full-width"><label>{t('notes')}</label><textarea name="description" value={formData.description} onChange={handleFormChange} rows="3" className="form-input" /></div>
                </>
              )}
            </div>
            {formError && <div className="error-message">{formError}</div>}
            {formSuccess && <div className="success-message">{formSuccess}</div>}
            <div className="form-actions"><button className="btn-primary" onClick={submitForm}>{editingDoc ? t('modifier') : t('ajouter')}</button><button className="btn-secondary" onClick={()=>setShowFormModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {/* Single Transfer Modal */}
      {showSingleTransferModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transferer')} : {singleTransferTarget?.sujet || ''}</h3>
              <button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field"><label>{t('service_destinataire')} *</label><select value={singleTransferServiceId} onChange={e => handleSingleServiceChange(e.target.value)}><option value="">--</option>{services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}</select></div>
              <div className="form-field"><label>{t('personne')} *</label><select value={singleTransferUserId} onChange={e => setSingleTransferUserId(e.target.value)}><option value="">--</option>{singleTransferUsers.map(u => <option key={u.id} value={u.id}>{u.nomComplet}</option>)}</select></div>
              <div className="form-field full-width"><label className="checkbox-field"><input type="checkbox" checked={singleTransferDoitRevenir} onChange={e => setSingleTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label></div>
              <div className="form-field full-width"><label>{t('message')}</label><textarea value={singleTransferMessage} onChange={e => setSingleTransferMessage(e.target.value)} rows="3" /></div>
            </div>
            <div className="form-actions"><button className="btn-primary" onClick={handleSingleTransfer}>{t('envoyer')}</button><button className="btn-secondary" onClick={() => setShowSingleTransferModal(false)}>{t('annuler')}</button></div>
          </div>
        </div>
      )}

      {/* Transfer Choice Modal */}
      {showTransferChoice && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('transfer_choice_title') || 'اختر طريقة الإحالة'}</h3>
              <button className="btn-secondary" onClick={() => setShowTransferChoice(false)}>{t('fermer')}</button>
            </div>
            <div className="form-actions" style={{ justifyContent: 'center', gap: '1rem' }}>
              <button className="btn-primary" onClick={() => handleTransferChoice('single')}>{t('transfer_to_one') || 'إلى شخص واحد'}</button>
              <button className="btn-primary" onClick={() => handleTransferChoice('multi')}>{t('transfer_to_many') || 'إلى عدة أشخاص'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Multi Transfer Modal */}
      {showTransferModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{bulkTransferDocs.length > 0 ? `${t('transferer')} ${bulkTransferDocs.length} documents` : `${t('transferer')} : ${transferTarget?.sujet || ''}`}</h3>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('fermer')}</button>
            </div>
            <div className="form-grid">
              <div className="form-field full-width">
                <label>{t('ajouter_personnes_service')}</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select value={transferCurrentService} onChange={e => handleTransferServiceChange(e.target.value)} style={{ flex: 1 }}>
                    <option value="">-- {t('choisir_service')} --</option>
                    {services.filter(s => s.idService !== serviceId).map(s => <option key={s.idService} value={s.idService}>{s.nomService}</option>)}
                  </select>
                  <button className="btn-secondary" onClick={addCurrentSelection} disabled={!transferCurrentService || transferCurrentUserIds.length === 0}>{t('ajouter')}</button>
                </div>
              </div>
              {transferCurrentService && (
                <div className="form-field full-width">
                  <label>{t('choisir_personnes')}</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                    {allUsers.filter(u => u.idService === Number(transferCurrentService)).map(u => (
                      <label key={u.id} className="transfer-user-label">
                        <input type="checkbox" checked={transferCurrentUserIds.includes(u.id)} onChange={() => toggleCurrentUser(u.id)} />
                        <span>{u.nomComplet}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {transferSelections.length > 0 && (
                <div className="form-field full-width">
                  <label>{t('personnes_selectionnees')}</label>
                  <div style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '0.5rem' }}>
                    {transferSelections.map(sel => {
                      const svc = services.find(s => s.idService === Number(sel.serviceId));
                      const svcName = svc ? svc.nomService : `Service #${sel.serviceId}`;
                      return (
                        <div key={sel.serviceId} style={{ marginBottom: '0.5rem', background: '#f9fbfd', padding: '0.5rem', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{svcName}</strong>
                            <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem' }} onClick={() => removeSelection(sel.serviceId)}>✕</button>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                            {allUsers.filter(u => sel.userIds.includes(u.id)).map(u => <span key={u.id} style={{ background: 'var(--soft-line)', padding: '0.15rem 0.5rem', borderRadius: '12px', fontSize: '0.8rem' }}>{u.nomComplet}</span>)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="form-field full-width">
                <label className="checkbox-field"><input type="checkbox" checked={transferDoitRevenir} onChange={e => setTransferDoitRevenir(e.target.checked)} /> {t('doit_revenir')}</label>
              </div>
              <div className="form-field full-width">
                <label>{t('message')}</label>
                <textarea value={transferMessage} onChange={e => setTransferMessage(e.target.value)} rows="3" />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-primary" onClick={handleMultiTransfer} disabled={transferSelections.flatMap(s => s.userIds).length === 0}>
                {t('envoyer')} ({transferSelections.flatMap(s => s.userIds).length})
              </button>
              <button className="btn-secondary" onClick={() => setShowTransferModal(false)}>{t('annuler')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Documents Modal */}
      {showHiddenModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="registry-panel-header">
              <h3>{t('documents_masques') || 'الوثائق المخفية'}</h3>
              <button className="btn-secondary" onClick={() => setShowHiddenModal(false)}>{t('fermer')}</button>
            </div>
            {hiddenIds.length === 0 ? <p className="text-muted">{t('aucun_document_masque')}</p> : (
              <div className="data-table-wrapper">
                <table className="modern-table">
                  <thead><tr><th>{t('titre')}</th><th>{t('type')}</th><th>{t('actions')}</th></tr></thead>
                  <tbody>
                    {hiddenIds.map(key => {
                      const doc = allDocuments.find(d => `${d.idEntite}_${d.type || d.Type}` === key);
                      if (!doc) return null;
                      return (
                        <tr key={key}>
                          <td>{doc.sujet || '-'}</td>
                          <td>{doc.type || '-'}</td>
                          <td className="action-icons"><button onClick={() => handleRestore(key)}>{t('restaurer') || 'استعادة'}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isModalOpen && modalDocument && <DocumentModal document={modalDocument} onClose={closeModal} />}
    </div>
  );
}

function getDocumentName(v) { if (!v) return ''; const clean = String(v).split('?')[0].split('#')[0]; return decodeURIComponent(clean.split('/').filter(Boolean).pop() || clean); }
function getDocumentHref(v) { if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; const nv = v.startsWith('/') ? v : `/${v}`; return window.location.hostname === 'localhost' && window.location.port === '3000' ? `http://localhost:5127${nv}` : nv; }
function getErrorMessage(err, fb) { if (typeof err?.response?.data === 'string') return err.response.data; if (err?.response?.data?.message) return err.response.data.message; if (err?.message) return err.message; return fb; }

export default MesEntites;