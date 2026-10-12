import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  UploadCloud,
  ScanSearch,
  GitBranch,
  History,
  FileText,
  Settings,
  ShieldCheck,
  RotateCcw,
  GitCompare
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { activeInvestigation, refreshInvestigations } = useInvestigation();
  const invId = activeInvestigation?.id || 'demo';

  const navItems = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Investigations', to: '/investigations', icon: FolderKanban },
    { name: 'Upload Evidence', to: `/investigations/${invId}/upload`, icon: UploadCloud },
    { name: 'Evidence Analysis', to: `/investigations/${invId}/analysis`, icon: ScanSearch },
    { name: 'Provenance Graph', to: `/investigations/${invId}/graph`, icon: GitBranch },
    { name: 'Evidence Time Machine', to: `/investigations/${invId}/time-machine`, icon: History },
    { name: 'Version Compare', to: `/investigations/${invId}/compare`, icon: GitCompare },
    { name: 'Reports', to: `/investigations/${invId}/reports`, icon: FileText },
    { name: 'Settings', to: '/settings', icon: Settings },
  ];

  const handleResetDemo = async () => {
    if (window.confirm('Reset fictional demonstration data (Hospital Reimbursement Review)?')) {
      try {
        await api.resetDemo();
        await refreshInvestigations();
        alert('Demonstration case reset successfully.');
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onClose}
        />
      )}

      {/* Persistent Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#EFE6D8] border-r border-[#E4D8C8] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E4D8C8] bg-[#EFE6D8]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-[#49372C] flex items-center justify-center text-[#EFE6D8] shadow-xs">
              <ShieldCheck className="w-5 h-5 text-[#B8754D]" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-[#49372C] tracking-tight leading-tight">TrustTrace AI</h1>
              <p className="text-[11px] font-medium text-[#786C60] leading-none mt-0.5">
                Beyond Fake Detection.
              </p>
            </div>
          </div>
        </div>

        {/* Active Investigation Context Tag */}
        {activeInvestigation && (
          <div className="px-4 py-2.5 mx-3 mt-3 bg-[#FFFDFA] border border-[#E4D8C8] rounded-md shadow-2xs">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#786C60]">Active Case</div>
            <div className="text-xs font-semibold text-[#49372C] truncate mt-0.5">
              {activeInvestigation.name}
            </div>
            <div className="text-[10px] text-[#B8754D] font-mono mt-0.5">
              {activeInvestigation.case_reference || 'NO-REF'} &bull; v{activeInvestigation.current_version}
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-[#CBA783]/35 text-[#49372C] font-semibold border-l-3 border-[#B8754D]'
                      : 'text-[#786C60] hover:text-[#302820] hover:bg-[#E4D8C8]/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-3 shrink-0 text-[#725541]" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Actions & Seed Demonstration */}
        <div className="p-3 border-t border-[#E4D8C8] space-y-2 bg-[#EFE6D8]">
          <button
            onClick={handleResetDemo}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 text-xs font-medium text-[#725541] bg-[#FFFDFA] hover:bg-[#F8F5EF] border border-[#E4D8C8] rounded-md shadow-2xs transition-colors"
            title="Reset demonstration data to initial test state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#B8754D]" />
            <span>Reset Demo Case</span>
          </button>

          <div className="px-2 py-1.5 text-[11px] text-[#786C60] text-center">
            Multi-Document Evidence Forensics &bull; v1.0
          </div>
        </div>
      </aside>
    </>
  );
};
