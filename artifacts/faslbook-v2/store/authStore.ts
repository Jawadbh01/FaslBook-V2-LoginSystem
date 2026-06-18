import { create } from "zustand";
import { User } from "firebase/auth";

interface Organization {
  id: string;
  farmId: string;
  name: string;
  village: string;
  district: string;
  province: string;
  landlordId: string;
}

interface AuthState {
  user: User | null;
  organization: Organization | null;
  role: "landlord" | "manager" | "farmer" | "worker" | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setOrganization: (org: Organization | null) => void;
  setRole: (role: AuthState["role"]) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  role: null,
  loading: true,

  setUser: (user) => set({ user }),
  setOrganization: (organization) => set({ organization }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),

  reset: () =>
    set({
      user: null,
      organization: null,
      role: null,
      loading: false,
    }),
}));
