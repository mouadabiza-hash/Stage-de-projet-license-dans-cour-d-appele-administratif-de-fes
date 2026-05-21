import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import PrivateRoute from './components/PrivateRoute';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard'; // un composant générique
import GererServices from './pages/GererServices';
import GererUtilisateurs from './pages/GererUtilisateurs';
import GererEquipements from './pages/GererEquipements';
import MesEntites from './pages/MesEntites';
import TransactionsOutgoing from './pages/TransactionsOutgoing';
import Notifications from './pages/Notifications';
import ActeursJudiciaires from './pages/ActeursJudiciaires';
import GererArchivesJuridiques from './pages/GererArchivesJuridiques';
import DossierSearch from './pages/DossierSearch';
import Profile from './pages/Profile';
import GestionCourriers from './pages/GestionCourriers';
import TousLesRetraits from './pages/TousLesRetraits';
import GestionListes from './pages/GestionListes';

// ... importez toutes vos pages (equipements, transactions, etc.)
import './theme.css';
// ... autres imports

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
     {/* Routes pour chaque fonctionnalité (selon les paths définis dans le menu) */}
      <Route path="/dossier-search" element={<PrivateRoute><MainLayout><DossierSearch /></MainLayout></PrivateRoute>} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
      <Route path="/courriers" element={<PrivateRoute><MainLayout><GestionCourriers /></MainLayout></PrivateRoute>} />
      <Route path="/mes-entites" element={<PrivateRoute><MainLayout><MesEntites /></MainLayout></PrivateRoute>} />
      <Route path="/transactions-outgoing" element={<PrivateRoute><MainLayout><TransactionsOutgoing /></MainLayout></PrivateRoute>} />
      <Route path="/tout-retraits" element={<PrivateRoute><MainLayout><TousLesRetraits /></MainLayout></PrivateRoute>} />
      <Route path="/notifications" element={<PrivateRoute><MainLayout><Notifications /></MainLayout></PrivateRoute>} />
      <Route path="/acteurs-judiciaires" element={<PrivateRoute><MainLayout><ActeursJudiciaires /></MainLayout></PrivateRoute>} />
      <Route path="/archives-juridiques" element={<PrivateRoute><MainLayout><GererArchivesJuridiques /></MainLayout></PrivateRoute>} />
      <Route path="/equipements" element={<PrivateRoute><MainLayout><GererEquipements /></MainLayout></PrivateRoute>} />
      <Route path="/services" element={<PrivateRoute><MainLayout><GererServices /></MainLayout></PrivateRoute>} />
      <Route path="/utilisateurs" element={<PrivateRoute><MainLayout><GererUtilisateurs /></MainLayout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><MainLayout><Profile /></MainLayout></PrivateRoute>} />
      <Route path="/gestion-listes" element={<PrivateRoute><MainLayout><GestionListes /></MainLayout></PrivateRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
