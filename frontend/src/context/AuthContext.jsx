import { createContext, useContext } from "react";
import { apiError } from "@/lib/api";

const AuthContext = createContext(null);

// Alat pribadi tanpa login: selalu bekerja sebagai satu akun pembukuan.
const STATIC_USER = { role: "admin", name: "Pembukuan" };

export function AuthProvider({ children }) {
  return (
    <AuthContext.Provider value={{ user: STATIC_USER, business: null, loading: false, apiError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
