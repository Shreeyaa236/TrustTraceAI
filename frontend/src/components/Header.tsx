import React, { useState } from 'react';
import { Menu, Search, Bell, ChevronDown, Check, User, PlusCircle, LogOut, LogIn } from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
  onOpenCreateModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, onOpenCreateModal }) => {
  const { investigations, activeInvestigation, setActiveInvestigation } = useInvestigation();
  const { user, isAuthenticated, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Determine breadcrumb label
  const pathParts = location.pathname.split('/').filter(Boolean);
  let breadcrumb = 'Overview';
  if (pathParts.length > 0) {
    const last = pathParts[pathParts.length - 1];
    breadcrumb = last.charAt(0).toUpperCase() + last.slice(1).replace('-', ' ');
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/investigations?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 bg-[#FFFDFA] border-b border-[#E4D8C8]">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-[#725541] rounded-md md:hidden hover:bg-[#EFE6D8]"
          aria-label="Toggle Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs md:text-sm">
          <span className="text-[#786C60]">TrustTrace</span>
          <span className="text-[#E4D8C8]">/</span>
          <span className="font-semibold text-[#49372C]">{breadcrumb}</span>
        </div>
      </div>

      {/* Middle: Investigation Selector Dropdown */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 px-3 py-1.5 text-xs md:text-sm font-medium text-[#49372C] bg-[#F8F5EF] hover:bg-[#EFE6D8] border border-[#E4D8C8] rounded-md transition-colors"
        >
          <span className="text-[#786C60] hidden sm:inline">Case:</span>
          <span className="font-semibold max-w-[150px] md:max-w-[240px] truncate">
            {activeInvestigation ? activeInvestigation.name : 'Select Investigation'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#725541]" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-72 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg shadow-lg py-1.5 z-50">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#786C60] border-b border-[#E4D8C8]">
              Switch Investigation
            </div>
            <div className="max-h-60 overflow-y-auto">
              {investigations.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => {
                    setActiveInvestigation(inv);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#F8F5EF] ${
                    activeInvestigation?.id === inv.id ? 'bg-[#EFE6D8] font-semibold text-[#49372C]' : 'text-[#302820]'
                  }`}
                >
                  <div className="truncate mr-2">
                    <div className="truncate">{inv.name}</div>
                    <div className="text-[10px] text-[#786C60]">{inv.case_reference || 'Ref: N/A'}</div>
                  </div>
                  {activeInvestigation?.id === inv.id && (
                    <Check className="w-4 h-4 text-[#B8754D] shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-[#E4D8C8]">
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  onOpenCreateModal();
                }}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Investigation</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: Global Search & Notifications & Profile */}
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#786C60]" />
          <input
            type="text"
            placeholder="Search records, claims..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs bg-[#F8F5EF] border border-[#E4D8C8] rounded-md text-[#302820] placeholder-[#786C60] focus:outline-hidden focus:border-[#B8754D] w-48 transition-all focus:w-64"
          />
        </form>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative p-2 text-[#725541] hover:text-[#49372C] hover:bg-[#EFE6D8] rounded-md transition-colors"
            title="Forensic Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B8754D]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg shadow-lg py-2 z-50">
              <div className="px-3 py-1 text-xs font-semibold text-[#49372C] border-b border-[#E4D8C8]">
                Audit & Verification Alerts
              </div>
              <div className="p-3 text-xs text-[#786C60] space-y-2">
                <div className="p-2 bg-[#F8F5EF] rounded-md border border-[#E4D8C8]">
                  <div className="font-medium text-[#49372C]">Demonstration Case Ready</div>
                  <div className="text-[11px] text-[#786C60] mt-0.5">
                    Hospital Reimbursement Review has 1 inconsistency finding and 1 evidence gap.
                  </div>
                </div>
                <div className="p-2 bg-[#F8F5EF] rounded-md border border-[#E4D8C8]">
                  <div className="font-medium text-[#49372C]">Rule Engine Active</div>
                  <div className="text-[11px] text-[#786C60] mt-0.5">
                    Deterministic cross-document checking is fully operational.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center space-x-2 pl-2 border-l border-[#E4D8C8] hover:opacity-85 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-[#EFE6D8] border border-[#CBA783] flex items-center justify-center text-[#49372C] text-xs font-semibold">
              <User className="w-4 h-4 text-[#725541]" />
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-[#49372C] leading-none">
                {user ? user.full_name : 'Guest Reviewer'}
              </div>
              <div className="text-[10px] text-[#786C60] leading-none mt-1">
                {user ? user.role : 'Read Only'}
              </div>
            </div>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[#FFFDFA] border border-[#E4D8C8] rounded-lg shadow-lg py-1.5 z-50 text-xs">
              <div className="px-3 py-2 border-b border-[#E4D8C8]">
                <div className="font-semibold text-[#49372C]">{user?.full_name || 'Investigator'}</div>
                <div className="text-[11px] text-[#786C60] truncate">{user?.email || 'Not logged in'}</div>
              </div>
              {isAuthenticated ? (
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] flex items-center space-x-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full text-left px-3 py-2 text-xs font-semibold text-[#B8754D] hover:bg-[#F8F5EF] flex items-center space-x-1.5 transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
