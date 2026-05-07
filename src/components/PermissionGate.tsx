import { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

type Props = {
  module: string;
  action: 'create' | 'edit' | 'delete';
  children: ReactNode;
};

export function PermissionGate({ module, action, children }: Props) {
  const { canCreate, canEdit, canDelete, isAdmin } = usePermissions();
  
  if (isAdmin) return <>{children}</>;
  
  const hasPermission = 
    action === 'create' ? canCreate(module) 
    : action === 'edit' ? canEdit(module)
    : canDelete(module);
  
  if (!hasPermission) return null;
  
  return <>{children}</>;
}
