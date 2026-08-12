import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { apiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("kasumkm_token");
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
      setBusiness(data.business);
    } catch (e) {
      localStorage.removeItem("kasumkm_token");
      setUser(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("kasumkm_token", data.access_token);
    setUser(data.user);
    await loadMe();
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("kasumkm_token", data.access_token);
    setUser(data.user);
    await loadMe();
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) {
      /* ignore */
    }
    localStorage.removeItem("kasumkm_token");
    setUser(false);
    setBusiness(null);
  };

  return (
    <AuthContext.Provider value={{ user, business, loading, login, register, logout, refresh: loadMe, setBusiness, apiError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
