import { useAuth } from '../context/AuthContext';
import AdminDashboard from '../dashboards/AdminDashboard';
import DirecteurDashboard from '../dashboards/DirecteurDashboard';
import GreffierDashboard from '../dashboards/GreffierDashboard';
import EnregistrementDashboard from '../dashboards/EnregistrementDashboard';
import ArchiveDashboard from '../dashboards/ArchiveDashboard';
import EmployeDashboard from '../dashboards/EmployeDashboard';

function DashboardRouter() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case 'Admin':
      return <AdminDashboard />;
    case 'Directeur':
      return <DirecteurDashboard />;
    case 'Greffier':
      return <GreffierDashboard />;
    case 'Enregistrement':
      return <EnregistrementDashboard />;
    case 'Archive':
      return <ArchiveDashboard />;
    case 'Employe':
    default:
      return <EmployeDashboard />;
  }
}

export default DashboardRouter;