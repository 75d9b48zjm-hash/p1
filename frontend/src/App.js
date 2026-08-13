import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/Bits";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import { ForgotPassword, ResetPassword } from "@/pages/PasswordPages";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBusinesses from "@/pages/AdminBusinesses";
import AdminBusinessDetail from "@/pages/AdminBusinessDetail";
import { AdminTransactions, AdminReports, AdminInsights, AdminCategories } from "@/pages/AdminPages";
import AdminCockpit from "@/pages/AdminCockpit";
import AuditLogs from "@/pages/AuditLogs";
import Settings from "@/pages/Settings";
import { MsmeDashboard, MsmeTransactions, MsmeReports, MsmeInsights } from "@/pages/MsmePages";

const Guard = ({ role, children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Loader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Loader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
};

const PublicOnly = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center"><Loader /></div>;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route path="/admin" element={<Guard role="admin"><AdminDashboard /></Guard>} />
          <Route path="/admin/umkm" element={<Guard role="admin"><AdminBusinesses /></Guard>} />
          <Route path="/admin/umkm/:businessId" element={<Guard role="admin"><AdminBusinessDetail /></Guard>} />
          <Route path="/admin/kategorisasi" element={<Guard role="admin"><AdminCockpit /></Guard>} />
          <Route path="/admin/transaksi" element={<Guard role="admin"><AdminTransactions /></Guard>} />
          <Route path="/admin/laporan" element={<Guard role="admin"><AdminReports /></Guard>} />
          <Route path="/admin/insight" element={<Guard role="admin"><AdminInsights /></Guard>} />
          <Route path="/admin/kategori" element={<Guard role="admin"><AdminCategories /></Guard>} />
          <Route path="/admin/audit" element={<Guard role="admin"><AuditLogs /></Guard>} />
          <Route path="/admin/pengaturan" element={<Guard role="admin"><Settings /></Guard>} />

          <Route path="/dashboard" element={<Guard role="msme"><MsmeDashboard /></Guard>} />
          <Route path="/transaksi" element={<Guard role="msme"><MsmeTransactions /></Guard>} />
          <Route path="/laporan" element={<Guard role="msme"><MsmeReports /></Guard>} />
          <Route path="/insight" element={<Guard role="msme"><MsmeInsights /></Guard>} />
          <Route path="/pengaturan" element={<Guard role="msme"><Settings /></Guard>} />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
