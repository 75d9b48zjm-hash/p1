import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Store, FileSpreadsheet, Menu, X, Wallet } from "lucide-react";
import { BACKEND_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";

const EXCEL_URL = `${BACKEND_URL}/api/excel/list`;

const NAV = [
  { to: "/", label: "Klien UMKM", Icon: Store },
];

export const Layout = ({ children, title, subtitle, action }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const isActive = (to) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  const SidebarInner = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-800/60">
        <span className="h-9 w-9 rounded-xl bg-emerald-500 grid place-items-center">
          <Wallet className="h-5 w-5 text-white" strokeWidth={2.4} />
        </span>
        <div>
          <p className="text-white font-bold leading-tight">KasUMKM</p>
          <p className="text-[11px] text-slate-400 leading-tight">Pembukuan Pribadi</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 ${
              isActive(to) ? "bg-emerald-500/15 text-emerald-300" : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
            {label}
          </Link>
        ))}
        <a
          href={EXCEL_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="nav-template-excel"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
        >
          <FileSpreadsheet className="h-4.5 w-4.5" strokeWidth={2.1} />
          Template Excel
        </a>
      </nav>
      <div className="p-3 border-t border-slate-800/60">
        <div className="px-3 py-2">
          <p className="text-sm text-white font-semibold truncate">Pembukuan</p>
          <p className="text-xs text-slate-400 truncate">Alat kerja pribadi</p>
        </div>
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
            {action}
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10 max-w-[1400px]">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex justify-around items-center shadow-lg">
        {NAV.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            data-testid={`bottomnav-${label.toLowerCase().replace(/\s+/g, "-")}`}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] transition-colors ${
              isActive(to) ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            <Icon className="h-5 w-5" strokeWidth={2.1} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        ))}
        <a
          href={EXCEL_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="bottomnav-template-excel"
          className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl min-w-[60px] text-slate-400"
        >
          <FileSpreadsheet className="h-5 w-5" strokeWidth={2.1} />
          <span className="text-[10px] font-semibold">Excel</span>
        </a>
      </nav>
    </div>
  );
};

export const Btn = Button;
