import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Store, ClipboardCheck, FileBarChart2, Lightbulb, Tags, ScrollText,
  Settings as SettingsIcon, LogOut, Bell, Menu, X, Wallet, Receipt,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";

const ADMIN_NAV = [
  { to: "/admin", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/umkm", label: "UMKM", Icon: Store },
  { to: "/admin/transaksi", label: "Transaksi", Icon: ClipboardCheck },
  { to: "/admin/laporan", label: "Laporan", Icon: FileBarChart2 },
  { to: "/admin/insight", label: "Analisis", Icon: Lightbulb },
  { to: "/admin/kategori", label: "Kategori", Icon: Tags },
  { to: "/admin/audit", label: "Log Audit", Icon: ScrollText },
  { to: "/admin/pengaturan", label: "Pengaturan", Icon: SettingsIcon },
];

const MSME_NAV = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/transaksi", label: "Transaksi", Icon: Receipt },
  { to: "/laporan", label: "Laporan", Icon: FileBarChart2 },
  { to: "/insight", label: "Analisis", Icon: Lightbulb },
  { to: "/pengaturan", label: "Pengaturan", Icon: SettingsIcon },
];

export const Layout = ({ children, title, subtitle, action }) => {
  const { user, business, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const nav = isAdmin ? ADMIN_NAV : MSME_NAV;
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notif, setNotif] = useState({ items: [], unread: 0 });

  useEffect(() => {
    api.get("/notifications").then(({ data }) => setNotif(data)).catch(() => {});
  }, [location.pathname]);

  useEffect(() => setOpen(false), [location.pathname]);

  const isActive = (to) => (to === "/admin" ? location.pathname === to : location.pathname.startsWith(to));

  const markRead = async () => {
    await api.post("/notifications/read-all").catch(() => {});
    setNotif((n) => ({ ...n, unread: 0 }));
  };

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800/60">
        <span className="h-9 w-9 rounded-xl bg-emerald-500 grid place-items-center">
          <Wallet className="h-5 w-5 text-white" strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-white font-bold leading-tight">KasUMKM</p>
          <p className="text-[11px] text-slate-400 leading-tight">Pembukuan Sederhana</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase()}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
              isActive(to) ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800/60">
        <div className="px-3 py-2">
          <p className="text-sm text-white font-semibold truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 truncate">{isAdmin ? "Admin / Pembukuan" : business?.name}</p>
        </div>
        <button
          data-testid="logout-button"
          onClick={doLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" /> Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 z-40">{SidebarInner}</aside>
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-slate-900 h-full">{SidebarInner}</aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <button className="md:hidden p-2 -ml-2 text-slate-600" data-testid="mobile-menu-button" onClick={() => setOpen(!open)}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{title}</h1>
              {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button data-testid="notification-bell" onClick={markRead} className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors">
                  <Bell className="h-5 w-5" />
                  {notif.unread > 0 && (
                    <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                      {notif.unread}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
                <p className="px-4 py-3 text-sm font-semibold border-b border-slate-100">Notifikasi</p>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notif.items.length === 0 && <p className="p-4 text-sm text-slate-500">Belum ada notifikasi.</p>}
                  {notif.items.map((n) => (
                    <div key={n.id} className="p-4" data-testid="notification-item">
                      <p className="text-sm font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            {action}
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10 max-w-[1400px]">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        {nav.slice(0, 5).map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            data-testid={`bottomnav-${label.toLowerCase()}`}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] transition-colors ${
              isActive(to) ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export const Btn = Button;
