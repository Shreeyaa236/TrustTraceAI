import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Node,
  Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  FileText,
  Building,
  X,
  ExternalLink
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { api } from '../services/api';
import { Badge } from '../components/Badge';

// --- CUSTOM NODE COMPONENTS WITH DIRECTIONAL HANDLES (TASK 6) ---

// 1. Claim Node
const ClaimNode = ({ data, selected }: { data: any; selected?: boolean }) => (
  <div
    className={`px-4 py-3 bg-[#FFFDFA] border-2 rounded-xl shadow-md min-w-[240px] max-w-[320px] transition-all relative ${
      selected ? 'border-[#B8754D] ring-2 ring-[#B8754D]/30' : 'border-[#49372C]'
    }`}
  >
    {/* Target handle from documents below */}
    <Handle
      id="claim-bottom"
      type="target"
      position={Position.Bottom}
      className="w-2.5 h-2.5 bg-[#49372C] hover:scale-125 transition-transform"
    />
    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#786C60]">
      <span>Primary Claim</span>
      <Badge variant="status">{data.status || 'Active'}</Badge>
    </div>
    <div className="mt-1 font-bold text-xs text-[#49372C] leading-snug">
      {data.label}
    </div>
    <div className="mt-1.5 text-[10px] text-[#786C60] flex items-center justify-between">
      <span>{data.category}</span>
      <span className="font-semibold">{data.connected_count || 0} links</span>
    </div>
    <Handle
      id="claim-top"
      type="source"
      position={Position.Top}
      className="w-2.5 h-2.5 bg-[#49372C]"
    />
  </div>
);

// 2. Document Node
const DocumentNode = ({ data, selected }: { data: any; selected?: boolean }) => (
  <div
    className={`px-3 py-2.5 bg-[#FFFDFA] border rounded-lg shadow-sm min-w-[210px] max-w-[260px] transition-all relative ${
      selected ? 'border-[#B8754D] ring-2 ring-[#B8754D]/30' : 'border-[#E4D8C8] hover:border-[#CBA783]'
    }`}
  >
    {/* Upward source to claim */}
    <Handle
      id="doc-top"
      type="source"
      position={Position.Top}
      className="w-2 h-2 bg-[#725541]"
    />
    {/* Right target from findings */}
    <Handle
      id="doc-right"
      type="target"
      position={Position.Right}
      className="w-2 h-2 bg-[#725541]"
    />
    {/* Left target */}
    <Handle
      id="doc-left"
      type="target"
      position={Position.Left}
      className="w-2 h-2 bg-[#725541]"
    />

    <div className="flex items-center space-x-2">
      <div className="w-6 h-6 rounded bg-[#EFE6D8] flex items-center justify-center text-[#725541] shrink-0">
        <FileText className="w-3.5 h-3.5 text-[#B8754D]" />
      </div>
      <div className="truncate">
        <div className="font-bold text-xs text-[#49372C] truncate">{data.label}</div>
        <div className="text-[10px] text-[#786C60] truncate">{data.category}</div>
      </div>
    </div>
    <div className="mt-2 pt-1.5 border-t border-[#E4D8C8] flex items-center justify-between text-[10px]">
      <span className="text-[#786C60]">{data.classification?.replace('PDF', '').trim()}</span>
      <span className="font-mono text-[#B8754D] font-semibold">{data.extracted_amounts?.[0] || 'No Amt'}</span>
    </div>

    {/* Downward source to facts / target from source issuers */}
    <Handle
      id="doc-bottom"
      type="source"
      position={Position.Bottom}
      className="w-2 h-2 bg-[#725541]"
    />
  </div>
);

// 3. Fact Node
const FactNode = ({ data, selected }: { data: any; selected?: boolean }) => (
  <div
    className={`px-3 py-1.5 bg-[#EFE6D8] border rounded-md shadow-2xs min-w-[140px] text-center transition-all relative ${
      selected ? 'border-[#B8754D] ring-2 ring-[#B8754D]/30' : 'border-[#CBA783]'
    }`}
  >
    <Handle
      id="fact-top"
      type="target"
      position={Position.Top}
      className="w-2 h-2 bg-[#725541]"
    />
    <div className="text-[9px] uppercase font-bold text-[#786C60]">{data.fact_type || 'Extracted Fact'}</div>
    <div className="font-bold text-xs text-[#49372C]">{data.value || data.label}</div>
    <Handle
      id="fact-bottom"
      type="source"
      position={Position.Bottom}
      className="w-2 h-2 bg-[#725541]"
    />
  </div>
);

// 4. Source Node
const SourceNode = ({ data, selected }: { data: any; selected?: boolean }) => (
  <div
    className={`px-3 py-2 bg-[#F8F5EF] border border-[#B8754D]/40 rounded-lg shadow-2xs min-w-[180px] transition-all relative ${
      selected ? 'ring-2 ring-[#B8754D]/30' : ''
    }`}
  >
    <Handle
      id="source-top"
      type="source"
      position={Position.Top}
      className="w-2 h-2 bg-[#B8754D]"
    />
    <div className="flex items-center space-x-1.5 text-[10px] font-bold text-[#B8754D]">
      <Building className="w-3 h-3" />
      <span>Source / Origin</span>
    </div>
    <div className="font-bold text-xs text-[#49372C] mt-0.5 truncate">{data.organization || data.label}</div>
    <div className="text-[10px] text-[#786C60] mt-0.5">{data.verification_status}</div>
    <Handle
      id="source-bottom"
      type="target"
      position={Position.Bottom}
      className="w-2 h-2 bg-[#B8754D]"
    />
  </div>
);

// 5. Finding Node
const FindingNode = ({ data, selected }: { data: any; selected?: boolean }) => (
  <div
    className={`px-3 py-2 bg-[#FFFDFA] border rounded-lg shadow-sm min-w-[180px] max-w-[220px] transition-all relative ${
      data.severity === 'High' ? 'border-[#991B1B]/40 bg-[#FEE2E2]/20' : 'border-[#B45309]/40 bg-[#FEF3C7]/20'
    } ${selected ? 'ring-2 ring-[#B8754D]/30' : ''}`}
  >
    <Handle
      id="finding-left"
      type="source"
      position={Position.Left}
      className="w-2 h-2 bg-[#991B1B]"
    />
    <div className="flex items-center justify-between text-[10px]">
      <span className="font-mono font-bold text-[#49372C]">{data.finding_id}</span>
      <Badge variant="severity">{data.severity}</Badge>
    </div>
    <div className="font-semibold text-xs text-[#49372C] mt-1 line-clamp-2">{data.explanation}</div>
    <Handle
      id="finding-right"
      type="target"
      position={Position.Right}
      className="w-2 h-2 bg-[#991B1B]"
    />
  </div>
);

export const ProvenanceGraph: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { activeInvestigation, selectInvestigationById } = useInvestigation();
  const navigate = useNavigate();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [, setLoading] = useState(true);
  const [selectedNodeData, setSelectedNodeData] = useState<any | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState('All');

  const targetId = id || activeInvestigation?.id || 'demo';

  const nodeTypes = useMemo(
    () => ({
      claimNode: ClaimNode,
      documentNode: DocumentNode,
      factNode: FactNode,
      sourceNode: SourceNode,
      findingNode: FindingNode,
    }),
    []
  );

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProvenanceGraph(targetId);

      const formattedNodes: Node[] = res.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
      }));

      const formattedEdges: Edge[] = res.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || undefined,
        targetHandle: e.targetHandle || undefined,
        type: e.type || 'smoothstep',
        label: e.label,
        animated: e.animated,
        style: e.style || { stroke: '#725541', strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: (e.style && e.style.stroke) || '#725541',
        },
        data: e.data,
      }));

      setNodes(formattedNodes);
      setEdges(formattedEdges);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [targetId, setNodes, setEdges]);

  useEffect(() => {
    if (id && (!activeInvestigation || activeInvestigation.id !== id)) {
      selectInvestigationById(id);
    }
    fetchGraph();
  }, [id, activeInvestigation, selectInvestigationById, fetchGraph]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeData(node.data);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeData(null);
  }, []);

  // Filtered nodes
  const displayNodes = useMemo(() => {
    return nodes.filter((n) => {
      if (nodeTypeFilter !== 'All' && n.type !== nodeTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const label = String(n.data?.label || '').toLowerCase();
        const cat = String(n.data?.category || '').toLowerCase();
        return label.includes(query) || cat.includes(query);
      }
      return true;
    });
  }, [nodes, nodeTypeFilter, searchQuery]);

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-[#49372C] tracking-tight">Evidence Provenance Graph</h1>
          <p className="text-xs text-[#786C60] mt-0.5">
            Interactive multi-document entity relationships, citations, and dependency paths built with NetworkX.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[#786C60]" />
            <input
              type="text"
              placeholder="Filter graph node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-[#FFFDFA] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D] w-36 sm:w-44"
            />
          </div>

          {/* Node Type Filter */}
          <select
            value={nodeTypeFilter}
            onChange={(e) => setNodeTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-[#FFFDFA] border border-[#E4D8C8] rounded-md text-[#302820] focus:outline-hidden focus:border-[#B8754D]"
          >
            <option value="All">Nodes: All</option>
            <option value="claimNode">Claims</option>
            <option value="documentNode">Documents</option>
            <option value="factNode">Facts</option>
            <option value="sourceNode">Sources</option>
            <option value="findingNode">Findings</option>
          </select>

          {/* Legend indicator */}
          <div className="hidden lg:flex items-center space-x-2 text-[11px] text-[#786C60] pl-2 border-l border-[#E4D8C8]">
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#2D5A3A] mr-1" /> Supports</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#991B1B] mr-1" /> Contradicts</span>
            <span className="flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-[#B8754D] mr-1" /> Issued By</span>
          </div>
        </div>
      </div>

      {/* Main Canvas + Side Panel Layout */}
      <div className="flex-1 relative bg-[#FFFDFA] border border-[#E4D8C8] rounded-xl overflow-hidden shadow-2xs flex">
        {/* React Flow Container */}
        <div className="flex-1 h-full w-full">
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            fitView
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="#E4D8C8" gap={20} size={1} />
            <Controls className="bg-[#FFFDFA]! border-[#E4D8C8]! rounded-lg! shadow-xs!" />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'claimNode') return '#49372C';
                if (n.type === 'documentNode') return '#B8754D';
                if (n.type === 'findingNode') return '#991B1B';
                return '#CBA783';
              }}
              className="bg-[#F8F5EF]! border-[#E4D8C8]! rounded-lg!"
            />
          </ReactFlow>
        </div>

        {/* Selected Node Inspection Side Panel */}
        {selectedNodeData && (
          <div className="w-80 md:w-96 border-l border-[#E4D8C8] bg-[#FFFDFA] p-5 overflow-y-auto z-20 flex flex-col justify-between shadow-lg animate-in slide-in-from-right-4 duration-150">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#786C60]">
                    Node Inspection
                  </span>
                  <h3 className="text-base font-bold text-[#49372C] mt-0.5">
                    {selectedNodeData.label || selectedNodeData.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNodeData(null)}
                  className="p-1 text-[#786C60] hover:text-[#49372C] rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Node Metadata Cards */}
              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                  <span className="font-semibold text-[#786C60]">Entity Classification:</span>
                  <div className="text-[#49372C] font-medium mt-0.5">{selectedNodeData.type}</div>
                </div>

                {selectedNodeData.category && (
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="font-semibold text-[#786C60]">Document Category:</span>
                    <div className="text-[#49372C] font-medium mt-0.5">{selectedNodeData.category}</div>
                  </div>
                )}

                {selectedNodeData.classification && (
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="font-semibold text-[#786C60]">Representation Forensics:</span>
                    <div className="text-[#49372C] font-medium mt-0.5">{selectedNodeData.classification}</div>
                  </div>
                )}

                {selectedNodeData.issuing_org && (
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="font-semibold text-[#786C60]">Issuing Organization:</span>
                    <div className="text-[#49372C] font-medium mt-0.5">{selectedNodeData.issuing_org}</div>
                  </div>
                )}

                {selectedNodeData.explanation && (
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="font-semibold text-[#786C60]">Forensic Detail:</span>
                    <div className="text-[#49372C] mt-0.5">{selectedNodeData.explanation}</div>
                  </div>
                )}

                {selectedNodeData.file_hash && (
                  <div className="p-3 bg-[#F8F5EF] rounded-lg border border-[#E4D8C8]">
                    <span className="font-semibold text-[#786C60]">Cryptographic Hash:</span>
                    <div className="font-mono text-[10px] text-[#725541] mt-0.5 break-all">
                      {selectedNodeData.file_hash}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions if Document Node */}
            {selectedNodeData.id && selectedNodeData.type === 'documentNode' && (
              <div className="pt-4 border-t border-[#E4D8C8] mt-4">
                <button
                  onClick={() => navigate(`/investigations/${targetId}/documents/${selectedNodeData.id}`)}
                  className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#B8754D] hover:bg-[#725541] rounded-md transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Document Details</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
