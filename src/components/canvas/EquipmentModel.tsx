import { useRef, useMemo, Suspense } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { MeshStandardMaterial, type Mesh } from 'three'
import type { Node } from '@xyflow/react'
import type { AVNodeData } from '@/types/av'
import { useDiagramStore } from '@/store/diagram-store'
import { flowToWorld, getScaleHint } from './three-utils'
import { getSignalColor } from '@/lib/signal-colors'

interface EquipmentModelProps {
  node: Node<AVNodeData>
  modelUrl?: string
  status?: string
  allNodes: Node<AVNodeData>[]
}

// Map component types and labels to 3D shape categories
function getShapeType(componentType: string, label: string, deviceRole?: string): string {
  const t = (componentType + ' ' + label).toLowerCase()
  if (t.includes('display') || t.includes('tv') || t.includes('projector') || t.includes('monitor')) return 'display'
  if (t.includes('speaker') || t.includes('subwoofer') || t.includes('wedge')) return 'speaker'
  if (t.includes('camera') || t.includes('ptz') || t.includes('owl')) return 'camera'
  if (t.includes('microphone') || t.includes('mic') || t.includes('wireless-mic')) return 'microphone'
  if (t.includes('mixer') || t.includes('console')) return 'mixer'
  if (t.includes('hub') || t.includes('adapter') || t.includes('dock')) return 'hub'
  if (t.includes('amplifier') || t.includes('amp')) return 'rack'
  if (t.includes('dsp') || t.includes('processor')) return 'rack'
  if (t.includes('switch') || t.includes('router') || t.includes('interface') || t.includes('dante')) return 'rack'
  if (t.includes('laptop') || t.includes('macbook') || t.includes('book pro')) return 'laptop'
  if (deviceRole === 'destination') return 'display'
  if (deviceRole === 'source') return 'source'
  return 'box'
}

// Get a color based on the primary signal domain
function getEquipColor(node: Node<AVNodeData>): string {
  const domains = node.data.ports.map(p => p.domain)
  const primary = domains[0] ?? 'audio'
  return getSignalColor(primary as 'audio' | 'video' | 'network' | 'power' | 'av-over-ip')
}

// Convert real dimensions to a single uniform scale factor
// Uses the largest dimension so objects are proportionally sized
// Reference: 20 inches = 1.0 scale unit
function getUniformDimensionScale(dims?: { width_inches: number; height_inches: number; depth_inches: number }): number | null {
  if (!dims || !dims.width_inches || !dims.height_inches) return null
  const largest = Math.max(dims.width_inches, dims.height_inches, dims.depth_inches || 1)
  return Math.max(largest / 20, 0.15) // floor at 0.15 so tiny items are still visible
}

export default function EquipmentModel({ node, modelUrl, status, allNodes }: EquipmentModelProps) {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId)
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode)
  const isSelected = selectedNodeId === node.id

  const position = useMemo(
    () => flowToWorld(node.position.x, node.position.y, allNodes),
    [node.position.x, node.position.y, allNodes],
  )

  const dims = node.data.dimensions as { width_inches: number; height_inches: number; depth_inches: number } | undefined
  const dimUniform = getUniformDimensionScale(dims)
  // Use real dimensions for uniform sizing when available, fall back to role-based hint
  const scale = dimUniform ?? getScaleHint(node.data.deviceRole)
  const handleClick = () => setSelectedNode(node.id)

  return (
    <group position={position}>
      {status === 'ready' && modelUrl ? (
        <Suspense fallback={
          <ProceduralEquipment
            componentType={node.data.componentType}
            label={node.data.label}
            deviceRole={node.data.deviceRole}
            accentColor={getEquipColor(node)}
            scale={scale}
            isSelected={isSelected}
            onClick={handleClick}
          />
        }>
          <LoadedModel
            url={modelUrl}
            scale={scale}
            isSelected={isSelected}
            onClick={handleClick}
          />
        </Suspense>
      ) : (
        <ProceduralEquipment
          componentType={node.data.componentType}
          label={node.data.label}
          deviceRole={node.data.deviceRole}
          accentColor={getEquipColor(node)}
          scale={scale}
          isSelected={isSelected}
          onClick={handleClick}
          generating={status === 'generating' || status === 'pending'}
        />
      )}

      {/* Floating label */}
      <Html
        position={[0, scale * 1.2 + 0.5, 0]}
        center
        distanceFactor={15}
        style={{ pointerEvents: 'none' }}
      >
        <div className="whitespace-nowrap text-[10px] font-medium bg-card/90 backdrop-blur px-2 py-0.5 rounded border border-border shadow-sm text-foreground">
          {node.data.label}
        </div>
      </Html>
    </group>
  )
}

function LoadedModel({
  url,
  scale,
  isSelected,
  onClick,
}: {
  url: string
  scale: number
  isSelected: boolean
  onClick: () => void
}) {
  const obj = useLoader(OBJLoader, url)
  const cloned = useMemo(() => {
    const clone = obj.clone()
    const mat = new MeshStandardMaterial({ color: '#b0b0b0', roughness: 0.6, metalness: 0.2 })
    clone.traverse((child) => {
      if ((child as Mesh).isMesh) {
        (child as Mesh).material = mat
      }
    })
    return clone
  }, [obj])

  return (
    <primitive
      object={cloned}
      scale={[scale, scale, scale]}
      onClick={(e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {isSelected && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[1, 0.7, 0.9]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.15} emissive="#3b82f6" emissiveIntensity={0.4} />
        </mesh>
      )}
    </primitive>
  )
}

/* ── Procedural 3D equipment shapes ── */

const BODY_MAT = { color: '#2a2a2e', roughness: 0.35, metalness: 0.6 }
const DARK_MAT = { color: '#1a1a1e', roughness: 0.4, metalness: 0.5 }

function ProceduralEquipment({
  componentType,
  label,
  deviceRole,
  accentColor,
  scale,
  isSelected,
  onClick,
  generating,
}: {
  componentType: string
  label: string
  deviceRole?: string
  accentColor: string
  scale: number
  isSelected: boolean
  onClick: () => void
  generating?: boolean
}) {
  const groupRef = useRef<Mesh>(null)
  const shape = getShapeType(componentType, label, deviceRole)

  useFrame((_, delta) => {
    if (generating && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.3
    }
  })

  const clickHandler = (e: { stopPropagation: () => void }) => { e.stopPropagation(); onClick() }
  const s = scale

  return (
    <group ref={groupRef as never} scale={[s, s, s]}>
      {/* Selection glow */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[2.2, 1.6, 1.6]} />
          <meshStandardMaterial color="#3b82f6" transparent opacity={0.12} emissive="#3b82f6" emissiveIntensity={0.5} />
        </mesh>
      )}

      {shape === 'display' && <DisplayShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'speaker' && <SpeakerShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'camera' && <CameraShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'microphone' && <MicrophoneShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'mixer' && <MixerShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'hub' && <HubShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'rack' && <RackShape accent={accentColor} onClick={clickHandler} />}
      {shape === 'laptop' && <LaptopShape accent={accentColor} onClick={clickHandler} />}
      {(shape === 'box' || shape === 'source') && <GenericBox accent={accentColor} onClick={clickHandler} />}
    </group>
  )
}

type ShapeProps = { accent: string; onClick: (e: { stopPropagation: () => void }) => void }

function HubShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Slim hub body */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.9, 0.18, 0.4]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Port cutouts on side */}
      {[-0.25, -0.05, 0.15].map((x, i) => (
        <mesh key={i} position={[x, 0.1, 0.205]}>
          <boxGeometry args={[0.12, 0.04, 0.01]} />
          <meshStandardMaterial color="#000" emissive={accent} emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Pigtail cable */}
      <mesh position={[-0.45, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Connector head */}
      <mesh position={[-0.6, 0.1, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.08]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
    </group>
  )
}

function DisplayShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Screen panel */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[1.8, 1.05, 0.08]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Screen face */}
      <mesh position={[0, 0.55, 0.045]}>
        <planeGeometry args={[1.65, 0.92]} />
        <meshStandardMaterial color="#0a0a12" emissive={accent} emissiveIntensity={0.08} roughness={0.1} metalness={0.0} />
      </mesh>
      {/* Stand */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.6, 0.06, 0.35]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[0.08, 0.3, 0.06]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
    </group>
  )
}

function SpeakerShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Cabinet */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.7, 1.1, 0.55]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Woofer */}
      <mesh position={[0, 0.4, 0.28]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 24]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.8} metalness={0.0} />
      </mesh>
      {/* Tweeter */}
      <mesh position={[0, 0.75, 0.28]}>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  )
}

function CameraShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[0.6, 0.4, 0.45]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Lens */}
      <mesh position={[0, 0.3, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.15, 0.18, 24]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Lens glass */}
      <mesh position={[0, 0.3, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.1, 24]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} roughness={0.0} metalness={1.0} />
      </mesh>
    </group>
  )
}

function MicrophoneShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Stand */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.03, 16]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Capsule */}
      <mesh position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.06, 0.12, 8, 16]} />
        <meshStandardMaterial color="#3a3a40" roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Grille ring */}
      <mesh position={[0, 0.62, 0]}>
        <torusGeometry args={[0.065, 0.008, 8, 24]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

function MixerShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Console body — angled */}
      <mesh position={[0, 0.18, 0]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[1.6, 0.12, 0.9]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Back panel (taller) */}
      <mesh position={[0, 0.28, -0.38]}>
        <boxGeometry args={[1.6, 0.22, 0.08]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Fader channels */}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x, i) => (
        <mesh key={i} position={[x, 0.26, 0.05]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.04, 0.02, 0.35]} />
          <meshStandardMaterial color={i === 0 ? accent : '#555'} emissive={i === 0 ? accent : '#333'} emissiveIntensity={0.3} roughness={0.3} metalness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function RackShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* 1U rack body */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[1.4, 0.14, 0.7]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Rack ears */}
      <mesh position={[-0.75, 0.15, 0.33]}>
        <boxGeometry args={[0.06, 0.14, 0.04]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      <mesh position={[0.75, 0.15, 0.33]}>
        <boxGeometry args={[0.06, 0.14, 0.04]} />
        <meshStandardMaterial {...DARK_MAT} />
      </mesh>
      {/* Status LEDs */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0.36]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1.0} />
        </mesh>
      ))}
    </group>
  )
}

function LaptopShape({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      {/* Base */}
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[1.0, 0.04, 0.7]} />
        <meshStandardMaterial color="#c0c0c8" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0.4, -0.32]} rotation={[-0.15, 0, 0]}>
        <boxGeometry args={[0.95, 0.62, 0.02]} />
        <meshStandardMaterial color="#c0c0c8" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Screen face */}
      <mesh position={[0, 0.4, -0.305]} rotation={[-0.15, 0, 0]}>
        <planeGeometry args={[0.85, 0.55]} />
        <meshStandardMaterial color="#0a0a12" emissive={accent} emissiveIntensity={0.06} roughness={0.05} />
      </mesh>
    </group>
  )
}

function GenericBox({ accent, onClick }: ShapeProps) {
  return (
    <group onClick={onClick}>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.8, 0.4, 0.6]} />
        <meshStandardMaterial {...BODY_MAT} />
      </mesh>
      {/* Accent stripe */}
      <mesh position={[0, 0.2, 0.305]}>
        <planeGeometry args={[0.7, 0.06]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
    </group>
  )
}
