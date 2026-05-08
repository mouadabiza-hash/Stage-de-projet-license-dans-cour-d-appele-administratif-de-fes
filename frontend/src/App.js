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
import GererCourriers from './pages/GererCourriers';
import MesEntites from './pages/MesEntites';
import TransactionsOutgoing from './pages/TransactionsOutgoing';
import Notifications from './pages/Notifications';
import MessagesAdministratifs from './pages/MessagesAdministratifs';
import ActeursJudiciaires from './pages/ActeursJudiciaires';
import GererCourriersJuridiques from './pages/GererCourriersJuridiques';
import GererArchivesJuridiques from './pages/GererArchivesJuridiques';
// ... puis dans les routes

// ... importez toutes vos pages (equipements, transactions, etc.)
import './theme.css';
// ... autres imports

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={
        <PrivateRoute>
          <MainLayout>
            <Dashboard />
          </MainLayout>
        </PrivateRoute>
      } />
      {/* Routes pour chaque fonctionnalité (selon les paths définis dans le menu) */}
      <Route path="/dashboard" element={<PrivateRoute><MainLayout><Dashboard /></MainLayout></PrivateRoute>} />
      <Route path="/mes-entites" element={<PrivateRoute><MainLayout><MesEntites /></MainLayout></PrivateRoute>} />
      <Route path="/transactions-outgoing" element={<PrivateRoute><MainLayout><TransactionsOutgoing /></MainLayout></PrivateRoute>} />
      <Route path="/notifications" element={<PrivateRoute><MainLayout><Notifications /></MainLayout></PrivateRoute>} />
      <Route path="/courriers" element={<PrivateRoute><MainLayout><GererCourriers /></MainLayout></PrivateRoute>} />
      <Route path="/messages-administratifs" element={<PrivateRoute><MainLayout><MessagesAdministratifs /></MainLayout></PrivateRoute>} />
      <Route path="/acteurs-judiciaires" element={<PrivateRoute><MainLayout><ActeursJudiciaires /></MainLayout></PrivateRoute>} />
      <Route path="/courriers-juridiques" element={<PrivateRoute><MainLayout><GererCourriersJuridiques /></MainLayout></PrivateRoute>} />
      <Route path="/archives-juridiques" element={<PrivateRoute><MainLayout><GererArchivesJuridiques /></MainLayout></PrivateRoute>} />
      <Route path="/equipements" element={<PrivateRoute><MainLayout><GererEquipements /></MainLayout></PrivateRoute>} />
      <Route path="/services" element={<PrivateRoute><MainLayout><GererServices /></MainLayout></PrivateRoute>} />
      <Route path="/utilisateurs" element={<PrivateRoute><MainLayout><GererUtilisateurs /></MainLayout></PrivateRoute>} />
      {/* ... ajoutez les autres routes */}
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
