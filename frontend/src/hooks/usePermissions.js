import { useAuth } from '../context/AuthContext';

const PERMISSIONS = {
  Admin:          { canCreate:true,  canDelete:true, canArchive:true,  canTransfer:true,  canExport:true,  canManageUsers:true,  canManageServices:true,  canManageEquipments:true,  canViewUsers:true,  canViewServices:true,  canViewEquipments:true,  canCreateAdministratif:true,  canCreateJuridique:true ,canSeeAdministrateur:true},
  Directeur:      { canCreate:false, canDelete:false, canArchive:false, canTransfer:true,  canExport:true,  canManageUsers:false, canManageServices:false, canManageEquipments:false, canViewUsers:true,  canViewServices:true,  canViewEquipments:true,  canCreateAdministratif:false, canCreateJuridique:false ,canSeeAdministrateur:true},
  Greffier:       { canCreate:true,  canDelete:true,  canArchive:false, canTransfer:true,  canExport:true, canManageUsers:false, canManageServices:false, canManageEquipments:true,  canViewUsers:false, canViewServices:false, canViewEquipments:true,  canCreateAdministratif:true,  canCreateJuridique:true ,canSeeAdministrateur:true},
  Enregistrement: { canCreate:true,  canDelete:true,  canArchive:false, canTransfer:true,  canExport:false, canManageUsers:false, canManageServices:false, canManageEquipments:false, canViewUsers:false, canViewServices:false, canViewEquipments:true,  canCreateAdministratif:false, canCreateJuridique:true ,canSeeAdministrateur:false},
  Archive:        { canCreate:false, canDelete:false, canArchive:true,  canTransfer:true,  canExport:false, canManageUsers:false, canManageServices:false, canManageEquipments:false, canViewUsers:false, canViewServices:false, canViewEquipments:true,  canCreateAdministratif:false, canCreateJuridique:false ,canSeeAdministrateur:false},
  Employe:        { canCreate:false, canDelete:false, canArchive:false, canTransfer:true,  canExport:false, canManageUsers:false, canManageServices:false, canManageEquipments:false, canViewUsers:false, canViewServices:false, canViewEquipments:true,  canCreateAdministratif:false, canCreateJuridique:false ,canSeeAdministrateur:false},
};

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || 'Employe';
  return PERMISSIONS[role] || PERMISSIONS.Employe;
}