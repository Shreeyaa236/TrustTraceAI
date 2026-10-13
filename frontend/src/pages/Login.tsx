import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('investigator@trusttrace.ai');
  const [password, setPassword] = useState('TrustTrace2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate('/investigations');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#FFFDFA] border border-[#E4D8C8] rounded-2xl shadow-lg p-8 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#EFE6D8] border border-[#CBA783] flex items-center justify-center text-[#B8754D]">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Sign in to TrustTrace AI</h1>
          <p className="text-xs text-[#786C60]">
            Forensic Cross-Document Corroboration & Evidence Verification
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#FEE2E2]/60 border border-[#991B1B]/30 rounded-lg flex items-center space-x-2 text-xs text-[#991B1B]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Email Address or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@trusttrace.ai"
                className="w-full pl-9 pr-3 py-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-9 pr-3 py-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In as Investigator'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Credentials Helper Box */}
        <div className="p-3 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[11px] text-[#786C60] space-y-1">
          <div className="font-semibold text-[#49372C] flex items-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#2D5A3A] mr-1" />
            Pre-configured Investigator Account:
          </div>
          <div>User: <code className="bg-[#EFE6D8] px-1 py-0.5 rounded font-mono">investigator@trusttrace.ai</code></div>
          <div>Pass: <code className="bg-[#EFE6D8] px-1 py-0.5 rounded font-mono">TrustTrace2026!</code></div>
        </div>

        <div className="text-center text-[11px] text-[#786C60]">
          Don't have an investigator account?{' '}
          <Link to="/register" className="font-bold text-[#B8754D] hover:underline">
            Register new credentials
          </Link>
        </div>
      </div>
    </div>
  );
};
