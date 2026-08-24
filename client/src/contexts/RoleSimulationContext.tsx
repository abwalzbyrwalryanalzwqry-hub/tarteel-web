import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TarteelRole } from "../../../shared/permissions";

export const ROLE_SIMULATION_STORAGE_KEY = "tarteel-role-simulation";

type SimulationState = { role: TarteelRole; startedAt: number };
type RoleSimulationValue = { simulation: SimulationState | null; startSimulation: (role: TarteelRole) => void; stopSimulation: () => void };

const RoleSimulationContext = createContext<RoleSimulationValue | null>(null);

export function RoleSimulationProvider({ children }: { children: React.ReactNode }) {
  const [simulation, setSimulation] = useState<SimulationState | null>(() => {
    try {
      const raw = sessionStorage.getItem(ROLE_SIMULATION_STORAGE_KEY);
      return raw ? JSON.parse(raw) as SimulationState : null;
    } catch { return null; }
  });

  useEffect(() => {
    try {
      if (simulation) sessionStorage.setItem(ROLE_SIMULATION_STORAGE_KEY, JSON.stringify(simulation));
      else sessionStorage.removeItem(ROLE_SIMULATION_STORAGE_KEY);
    } catch {}
  }, [simulation]);

  const value = useMemo(() => ({
    simulation,
    startSimulation: (role: TarteelRole) => setSimulation({ role, startedAt: Date.now() }),
    stopSimulation: () => setSimulation(null),
  }), [simulation]);

  return <RoleSimulationContext.Provider value={value}>{children}</RoleSimulationContext.Provider>;
}

export function useRoleSimulation() {
  const context = useContext(RoleSimulationContext);
  if (!context) throw new Error("useRoleSimulation must be used within RoleSimulationProvider");
  return context;
}
