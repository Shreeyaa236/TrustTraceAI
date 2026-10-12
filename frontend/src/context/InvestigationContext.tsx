import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Investigation } from '../types';
import { api } from '../services/api';

interface InvestigationContextType {
  investigations: Investigation[];
  activeInvestigation: Investigation | null;
  setActiveInvestigation: (inv: Investigation | null) => void;
  loading: boolean;
  refreshInvestigations: () => Promise<void>;
  selectInvestigationById: (id: string) => void;
}

const InvestigationContext = createContext<InvestigationContextType | undefined>(undefined);

export const InvestigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [activeInvestigation, setActiveInvestigation] = useState<Investigation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshInvestigations = async () => {
    try {
      setLoading(true);
      const list = await api.getInvestigations();
      setInvestigations(list);
      
      // If no active investigation or current active not in list, pick the first one (demo or recent)
      if (list.length > 0) {
        if (!activeInvestigation || !list.some(i => i.id === activeInvestigation.id)) {
          setActiveInvestigation(list[0]);
        } else {
          const updated = list.find(i => i.id === activeInvestigation.id);
          if (updated) setActiveInvestigation(updated);
        }
      } else {
        setActiveInvestigation(null);
      }
    } catch (err) {
      console.error('Failed to load investigations:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectInvestigationById = (id: string) => {
    const found = investigations.find(i => i.id === id);
    if (found) {
      setActiveInvestigation(found);
    } else {
      // Try to fetch it
      api.getInvestigation(id).then(inv => {
        setActiveInvestigation(inv);
      }).catch(console.error);
    }
  };

  useEffect(() => {
    refreshInvestigations();
  }, []);

  return (
    <InvestigationContext.Provider
      value={{
        investigations,
        activeInvestigation,
        setActiveInvestigation,
        loading,
        refreshInvestigations,
        selectInvestigationById,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
};

export const useInvestigation = () => {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within an InvestigationProvider');
  }
  return context;
};
