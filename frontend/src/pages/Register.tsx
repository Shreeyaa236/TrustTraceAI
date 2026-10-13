import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, User as UserIcon, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await register(email, username, password, fullName);
      navigate('/investigations');
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
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
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Create Investigator Account</h1>
          <p className="text-xs text-[#786C60]">
            Sign up to manage and isolate private forensic investigations
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#FEE2E2]/60 border border-[#991B1B]/30 rounded-lg flex items-center space-x-2 text-xs text-[#991B1B]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Full Name
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Eleanor Vance"
                className="w-full pl-9 pr-3 py-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Username
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="evance"
                className="w-full pl-9 pr-3 py-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investigator@org.com"
                className="w-full pl-9 pr-3 py-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Password (min. 6 characters)
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

          <div>
            <label className="block text-[11px] font-semibold text-[#786C60] mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-[#786C60]" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
            <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="text-center text-[11px] text-[#786C60]">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-[#B8754D] hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
};
