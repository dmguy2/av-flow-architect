import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { Box } from 'lucide-react'
import { useDiagramStore } from '@/store/diagram-store'
import EquipmentModel from './EquipmentModel'
import SignalCable from './SignalCable'
import GenerationOverlay from './GenerationOverlay'

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export default function ThreeDCanvas() {
  const nodes = useDiagramStore((s) => s.nodes)
  const edges = useDiagramStore((s) => s.edges)
  const model3dUrls = useDiagramStore((s) => s.model3dUrls)
  const model3dStatus = useDiagramStore((s) => s.model3dStatus)
  const generate3DModels = useDiagramStore((s) => s.generate3DModels)

  // Check WebGL support before rendering
  const webglSupported = useMemo(() => isWebGLAvailable(), [])

  // Trigger model generation when entering 3D view
  useEffect(() => {
    if (webglSupported) generate3DModels()
  }, [generate3DModels, webglSupported])

  if (!webglSupported) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-background">
        <Box className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">WebGL is not available in this browser</p>
        <p className="text-xs text-muted-foreground/60">3D view requires WebGL support. Try a different browser or enable hardware acceleration.</p>
      </div>
    )
  }

  // Render all equipment nodes (signalFlow + physicalLayout), not just signalFlow
  const equipmentNodes = useMemo(
    () => nodes.filter((n) => n.type === 'signalFlow' || n.type === 'physicalLayout'),
    [nodes],
  )

  const hasNodes = equipmentNodes.length > 0
  const statusEntries = Object.entries(model3dStatus)
  const isGenerating = statusEntries.some(([, s]) => s === 'generating')
  const hasImages = equipmentNodes.some((n) => n.data.image)

  return (
    <div className="flex-1 h-full relative">
      <GenerationOverlay statuses={model3dStatus} />

      {/* Status message when no models are generating */}
      {hasNodes && !isGenerating && statusEntries.length === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/80 backdrop-blur border border-border rounded-lg px-4 py-2 shadow-lg">
          <Box className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {hasImages
              ? 'Ready to generate 3D models — processing will begin shortly'
              : 'No product images available — showing placeholder models'}
          </span>
        </div>
      )}

      {!hasNodes && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Box className="w-8 h-8" />
            <span className="text-sm">Drop components on the canvas to see them in 3D</span>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 15, 20], fov: 50 }} style={{ background: '#1a1a2e' }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow />
        <directionalLight position={[-5, 10, -5]} intensity={0.3} />
        <fog attach="fog" args={['#1a1a2e', 30, 80]} />

        {/* Ground grid */}
        <Grid
          args={[100, 100]}
          cellSize={1}
          sectionSize={5}
          fadeDistance={50}
          fadeStrength={1}
          cellColor="#2a2a4a"
          sectionColor="#3a3a6a"
        />

        {/* Equipment models */}
        {equipmentNodes.map((node) => (
          <EquipmentModel
            key={node.id}
            node={node}
            modelUrl={model3dUrls[node.data.componentType]}
            status={model3dStatus[node.data.componentType] ?? (node.data.image ? 'pending' : undefined)}
            allNodes={equipmentNodes}
          />
        ))}

        {/* Signal cables */}
        {edges.map((edge) => (
          <SignalCable key={edge.id} edge={edge} nodes={equipmentNodes} />
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  )
}
