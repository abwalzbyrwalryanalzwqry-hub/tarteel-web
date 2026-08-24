import { useAuth } from "@/_core/hooks/useAuth";
import {
  hasTarteelPermission,
  normalizeTarteelRole,
  ROLE_LABELS,
  type TarteelPermission,
} from "../../../shared/permissions";
import { useRoleSimulation } from "@/contexts/RoleSimulationContext";

export function usePermissions() {
  const { user } = useAuth();
  const { simulation } = useRoleSimulation();
  const actualRole = normalizeTarteelRole(user?.role);
  const role = simulation?.role ?? actualRole;

  return {
    role,
    actualRole,
    isSimulating: Boolean(simulation),
    roleLabel: ROLE_LABELS[role],
    can: (permission: TarteelPermission) => hasTarteelPermission(role, permission),
  };
}
