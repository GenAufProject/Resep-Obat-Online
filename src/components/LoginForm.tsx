import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
  Activity, 
  Lock, 
  Mail, 
  UserPlus, 
  LogIn, 
  AlertCircle, 
  FolderSync, 
  ArrowRight,
  Info
} from "lucide-react";

interface LoginFormProps {
  auth: any;
  isFirebaseReady: boolean;
  onSuccess: (user: any) => void;
  onGuestSuccess: () => void;
}

export function LoginForm({ auth, isFirebaseReady, onSuccess, onGuestSuccess }: LoginFormProps) {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Email dan password wajib diisi");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password minimal harus 6 karakter");
      return;
    }

    setLoading(true);

    if (isFirebaseReady && auth) {
      try {
        if (isRegister) {
          const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
          onSuccess(credentials.user);
        } else {
          const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
          onSuccess(credentials.user);
        }
      } catch (err: any) {
        console.error("Auth operation failed:", err);
        let niceMessage = "Gagal memproses otentikasi.";
        if (err.code === "auth/email-already-in-use") {
          niceMessage = "Email sudah terdaftar. Silakan login.";
        } else if (err.code === "auth/invalid-credential") {
          niceMessage = "E-mail atau password salah. Silakan coba kembali.";
        } else if (err.code === "auth/weak-password") {
          niceMessage = "Password terlalu lemah.";
        } else {
          niceMessage = err.message || niceMessage;
        }
        setErrorMsg(niceMessage);
      } finally {
        setLoading(false);
      }
    } else {
      // Offline fallback / mock authentication
      setTimeout(() => {
        setLoading(false);
        // Let them login with anything
        onSuccess({ uid: "guest_simulated", email: email.trim() });
      }, 800);
    }
  };

  const handleGuestLogin = () => {
    onGuestSuccess();
  };

  return (
    <div className="min-h-screen bg-[#f6f9f7] flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none selection:bg-brand-pink/35 selection:text-brand-dark">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Brand Logo & Header */}
        <div className="text-center mb-8 space-y-3">
          <div className="bg-gradient-to-tr from-brand-medium to-brand-dark p-3 rounded-2xl w-14 h-14 mx-auto flex items-center justify-between shadow-[0_8px_30px_rgb(7,87,91,0.2)]">
            <Activity className="w-8 h-8 text-white mx-auto" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-dark">
              Apotek Rekap Resep
            </h1>
            <p className="text-xs text-slate-500 font-semibold max-w-xs mx-auto">
              Simpan resep aman dalam Cloud, kelola stok bulanan secara cerdas dan otomatis.
            </p>
          </div>
        </div>

        {/* Auth Panel Card */}
        <div className="bg-white border-2 border-brand-light rounded-3xl p-6 sm:p-8 shadow-[0_8px_32px_-4px_rgba(0,59,70,0.05)] space-y-6">
          <div className="flex border-b border-brand-light/45 pb-1">
            <button
              onClick={() => { setIsRegister(false); setErrorMsg(""); }}
              className={`flex-1 pb-3 text-sm font-extrabold transition-all border-b-2 text-center uppercase tracking-wider ${
                !isRegister
                  ? "border-brand-medium text-brand-medium"
                  : "border-transparent text-slate-450 hover:text-slate-600"
              }`}
            >
              Masuk
            </button>
            <button
              onClick={() => { setIsRegister(true); setErrorMsg(""); }}
              className={`flex-1 pb-3 text-sm font-extrabold transition-all border-b-2 text-center uppercase tracking-wider ${
                isRegister
                  ? "border-brand-medium text-brand-medium"
                  : "border-transparent text-slate-450 hover:text-slate-600"
              }`}
            >
              Daftar Baru
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-brand-pink/15 border border-brand-pink text-xs text-brand-dark p-3.5 rounded-xl flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 text-brand-pink shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{errorMsg}</span>
              </motion.div>
            )}

            {!isFirebaseReady && (
              <div className="bg-[#ffb30f]/10 border border-[#ffb30f]/35 text-[11px] text-brand-dark p-3 rounded-xl flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-brand-medium shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">
                  Mode Integrasi Lokal Aktif: Anda bisa mendaftar dengan email apa saja secara instan.
                </span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Alamat Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="name@apotek.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#fdf0d5]/15 font-medium rounded-xl border border-brand-light/75 py-2.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-medium focus:ring-1 focus:ring-brand-medium"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#fdf0d5]/15 font-medium rounded-xl border border-brand-light/75 py-2.5 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-medium focus:ring-1 focus:ring-brand-medium"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-medium hover:bg-brand-dark text-white rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : isRegister ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Daftar Akun Sekarang</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk Aplikasi</span>
                </>
              )}
            </button>
          </form>

          {/* Divider and Guest access fellbacks */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-brand-light"></div>
            <span className="flex-shrink mx-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
              ATAU
            </span>
            <div className="flex-grow border-t border-brand-light"></div>
          </div>

          <button
            onClick={handleGuestLogin}
            className="w-full bg-brand-light/25 hover:bg-brand-light/50 border border-brand-light text-brand-dark rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FolderSync className="w-4 h-4 text-brand-medium" />
            <span>Gunakan Offline Mode (Tanpa Akun)</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
          </button>
        </div>

        {/* Bottom Credits */}
        <p className="text-center text-[10px] text-slate-450 font-bold uppercase tracking-widest mt-8">
          DIPERSENYATA UTK KEAMANAN APOTEKER INDONESIA
        </p>
      </motion.div>
    </div>
  );
}
