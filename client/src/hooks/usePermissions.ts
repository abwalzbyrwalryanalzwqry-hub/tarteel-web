import { useAuth } from "@/_core/hooks/useAuth";
import {
  hasTarteelPermission,
  normalizeTarteelRole,
  ROLE_LABELS,
  type TarteelPermission,
} from "../../../shared/permissions";

export function usePermissions() {
  const { user } = useAuth();
  const role = normalizeTarteelRole(user?.role);

  return {
    role,
    roleLabel: ROLE_LABELS[role],
    can: (permission: TarteelPermission) => hasTarteelPermission(role, permission),
  };
}
