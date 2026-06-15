import React from "react";
import { 
  auth, 
  isFirebaseConfigured 
} from "@/src/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from "firebase/auth";
import { 
  Cloud, 
  CloudOff, 
  LogIn, 
  LogOut, 
  ShieldAlert, 
  ToggleLeft,
  UserCheck
} from "lucide-react";

interface SyncBannerProps {
  user: User | null;
  loading: boolean;
  totalPrescriptions: number;
}

export const SyncBanner: React.FC<SyncBannerProps> = ({ 
  user, 
  loading,
  totalPrescriptions 
}) => {
  const handleLogin = async () => {
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login Error:", err);
      alert("Gagal masuk dengan Google. Silakan coba lagi.");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("rekap_guest_session");
    if (!auth) {
      window.location.reload();
      return;
    }
    try {
      await signOut(auth);
      window.location.reload();
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const isGuest = user?.uid === "guest_user" || user?.uid === "guest_simulated";

  return (
    <div id="sync-banner" className="bg-[#fdf0d5]/35 border-b-2 border-brand-light py-3 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Connection status display */}
        <div className="flex items-center gap-3">
          {isFirebaseConfigured ? (
            user ? (
              isGuest ? (
                <div className="flex items-center gap-2 text-brand-dark bg-[#dfd1af]/30 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#dfd1af]">
                  <CloudOff className="w-3.5 h-3.5 inline text-[#07575b]" />
                  <span>Sesi Luring (Akses Browser Lokal Aktif)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-800 bg-[#e2f5ec] px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#c4ecda]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Cloud className="w-3.5 h-3.5 inline text-emerald-600" />
                  <span>Terhubung ke Cloud Sync ({user.displayName || user.email})</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-amber-800 bg-[#fef7e0] px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#fce9b3]">
                <CloudOff className="w-3.5 h-3.5 text-amber-500" />
                <span>Belum Berhasil Masuk Sesi Rekap</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 text-[#003b46] bg-brand-pink/15 px-3 py-1.5 rounded-xl text-xs font-semibold border border-brand-pink/35">
              <ShieldAlert className="w-3.5 h-3.5 text-brand-pink" />
              <span>Offline Pro (Penyimpanan database di memori internal browser disetujui)</span>
            </div>
          )}
          
          <div className="hidden md:flex items-center gap-1.5 text-slate-500 text-xs font-bold">
            <span>•</span>
            <span className="text-brand-medium">{totalPrescriptions} resep dalam database</span>
          </div>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-2">
          {loading ? (
            <span className="text-xs text-slate-500 animate-pulse font-medium">Menghubungkan...</span>
          ) : user ? (
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 bg-white hover:bg-brand-pink/10 text-brand-dark text-xs py-1.5 px-3 rounded-xl font-bold transition border-2 border-brand-light hover:border-brand-pink/30 shadow-none cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-brand-pink" />
              Keluar Sesi
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
