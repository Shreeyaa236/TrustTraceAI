import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { InvestigationProvider } from './context/InvestigationContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { CreateInvestigationModal } from './components/CreateInvestigationModal';

// Pages
import { Overview } from './pages/Overview';
import { Investigations } from './pages/Investigations';
import { UploadEvidence } from './pages/UploadEvidence';
import { EvidenceAnalysis } from './pages/EvidenceAnalysis';
import { ProvenanceGraph } from './pages/ProvenanceGraph';
import { EvidenceTimeMachine } from './pages/EvidenceTimeMachine';
import { VersionCompare } from './pages/VersionCompare';
import { DocumentDetail } from './pages/DocumentDetail';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <InvestigationProvider>
      <Router>
        <div className="min-h-screen bg-[#F8F5EF] flex flex-col md:flex-row text-[#302820]">
          {/* Sidebar */}
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 md:pl-64">
            <Header
              onMenuClick={() => setSidebarOpen(true)}
              onOpenCreateModal={() => setCreateModalOpen(true)}
            />

            <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
              <Routes>
                <Route path="/" element={<Overview onOpenCreateModal={() => setCreateModalOpen(true)} />} />
                <Route path="/investigations" element={<Investigations onOpenCreateModal={() => setCreateModalOpen(true)} />} />
                <Route path="/investigations/:id/upload" element={<UploadEvidence />} />
                <Route path="/investigations/:id/analysis" element={<EvidenceAnalysis />} />
                <Route path="/investigations/:id/graph" element={<ProvenanceGraph />} />
                <Route path="/investigations/:id/time-machine" element={<EvidenceTimeMachine />} />
                <Route path="/investigations/:id/compare" element={<VersionCompare />} />
                <Route path="/investigations/:id/documents/:docId" element={<DocumentDetail />} />
                <Route path="/investigations/:id/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>

          {/* Create Investigation Modal */}
          <CreateInvestigationModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
          />
        </div>
      </Router>
    </InvestigationProvider>
  );
}

export default App;
