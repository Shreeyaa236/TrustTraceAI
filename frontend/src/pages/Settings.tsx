import React, { useState, useEffect } from 'react';
import {
  User,
  Database,
  Cpu,
  Save,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { useInvestigation } from '../context/InvestigationContext';

export const Settings: React.FC = () => {
  const { refreshInvestigations } = useInvestigation();
  const [saving, setSaving] = useState(false);
  const [llmStatus, setLlmStatus] = useState<any>(null);

  // Settings State
  const [userName, setUserName] = useState('Senior Investigator');
  const [userRole, setUserRole] = useState('Lead Digital Forensics Reviewer');
  const [userEmail, setUserEmail] = useState('investigator@trusttrace.ai');

  const [emailAlerts, setEmailAlerts] = useState(true);
  const [criticalContradictions, setCriticalContradictions] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const [retentionDays, setRetentionDays] = useState(90);
  const [llmProvider, setLlmProvider] = useState('none');
  const [strictness, setStrictness] = useState('Standard');

  useEffect(() => {
    Promise.all([api.getSettings(), api.getLlmStatus()]).then(([s, l]) => {
      if (s) {
        if (s.user_profile) {
          setUserName(s.user_profile.name || 'Senior Investigator');
          setUserRole(s.user_profile.role || 'Lead Digital Forensics Reviewer');
          setUserEmail(s.user_profile.email || 'investigator@trusttrace.ai');
        }
        if (s.notification_preferences) {
          setEmailAlerts(s.notification_preferences.email_alerts ?? true);
          setCriticalContradictions(s.notification_preferences.critical_contradictions ?? true);
          setWeeklyDigest(s.notification_preferences.weekly_digest ?? false);
        }
        if (s.data_retention_days) setRetentionDays(s.data_retention_days);
        if (s.llm_provider) setLlmProvider(s.llm_provider);
        if (s.deterministic_strictness) setStrictness(s.deterministic_strictness);
      }
      setLlmStatus(l);
    }).catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.saveSettings({
        user_profile: { name: userName, role: userRole, email: userEmail },
        notification_preferences: {
          email_alerts: emailAlerts,
          critical_contradictions: criticalContradictions,
          weekly_digest: weeklyDigest,
        },
        data_retention_days: retentionDays,
        llm_provider: llmProvider,
        deterministic_strictness: strictness,
      });
      alert('Settings updated successfully.');
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handlePurgeAll = async () => {
    if (window.confirm('Reset all demonstration data and restore factory defaults?')) {
      try {
        await api.resetDemo();
        await refreshInvestigations();
        alert('All demonstration cases reset successfully.');
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">System Settings & Privacy</h1>
        <p className="text-sm text-[#786C60] mt-1">
          Configure forensic reviewer profiles, notification thresholds, data retention policies, and AI integration.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* User Profile Card */}
        <div className="p-6 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E4D8C8]">
            <User className="w-4 h-4 text-[#725541]" />
            <h2 className="text-sm font-bold text-[#49372C]">Reviewer Profile</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Full Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Role Title</label>
              <input
                type="text"
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Audit Email</label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              />
            </div>
          </div>
        </div>

        {/* Connected AI Services */}
        <div className="p-6 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E4D8C8]">
            <Cpu className="w-4 h-4 text-[#725541]" />
            <h2 className="text-sm font-bold text-[#49372C]">Connected AI Services</h2>
          </div>

          <p className="text-xs text-[#786C60]">
            Deterministic cross-document checking (amounts, dates, hashes, and fonts) operates independently without any external AI API. Optional LLM integrations provide assisted natural-language summary synthesis.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#786C60] mb-1">LLM Provider</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              >
                <option value="none">None (Deterministic Rule Engine Only)</option>
                <option value="gemini">Google Gemini API (via GEMINI_API_KEY)</option>
                <option value="openai">OpenAI API (via OPENAI_API_KEY)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Deterministic Strictness</label>
              <select
                value={strictness}
                onChange={(e) => setStrictness(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              >
                <option value="Standard">Standard Forensic Threshold</option>
                <option value="Strict">Strict (Flag any decimal variance)</option>
                <option value="Relaxed">Relaxed (Allow minor formatting variance)</option>
              </select>
            </div>
          </div>

          {llmStatus && (
            <div className="p-3 bg-[#F8F5EF] border border-[#E4D8C8] rounded-lg text-xs text-[#786C60]">
              <span className="font-semibold text-[#49372C]">Current Engine Status: </span>
              {llmStatus.message}
            </div>
          )}
        </div>

        {/* Data Retention & Privacy Policy */}
        <div className="p-6 bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl shadow-2xs space-y-4">
          <div className="flex items-center space-x-2.5 pb-3 border-b border-[#E4D8C8]">
            <Database className="w-4 h-4 text-[#725541]" />
            <h2 className="text-sm font-bold text-[#49372C]">Data Retention & Custody Policy</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Evidence Retention Period</label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
              >
                <option value={30}>30 Days</option>
                <option value={90}>90 Days (Recommended)</option>
                <option value={180}>180 Days</option>
                <option value={365}>1 Year (Legal Hold)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[#786C60] mb-1">Storage Repository</label>
              <div className="p-2 bg-[#F8F5EF] border border-[#E4D8C8] rounded-md font-mono text-[11px] text-[#725541]">
                MongoDB / Local Secure JSON Store
              </div>
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handlePurgeAll}
            className="flex items-center space-x-1.5 px-3 py-2 text-xs font-medium text-[#991B1B] hover:bg-[#FEE2E2] rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Reset Demo Cases to Factory Default</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md shadow-xs transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
