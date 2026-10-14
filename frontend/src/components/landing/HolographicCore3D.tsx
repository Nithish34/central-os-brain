import React, { useEffect, useRef } from 'react';

interface HolographicCore3DProps {
  pulseTrigger?: number;
  activeScenarioRisk?: string;
  className?: string;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseColor: string;
  size: number;
}

interface OrbitalPacket {
  ringIndex: number;
  angle: number;
  speed: number;
  color: string;
}

export const HolographicCore3D: React.FC<HolographicCore3DProps> = ({
  pulseTrigger = 0,
  activeScenarioRisk = 'LOW',
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shockwavesRef = useRef<{ radius: number; maxRadius: number; color: string; opacity: number }[]>([]);
  const mouseRotationRef = useRef<{ velX: number; velY: number; isDragging: boolean; lastX: number; lastY: number }>({
    velX: 0.003,
    velY: 0.006,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Track shockwave trigger from props
  const prevTriggerRef = useRef(pulseTrigger);
  useEffect(() => {
    if (pulseTrigger > 0 && pulseTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = pulseTrigger;
      // Spawn new expanding shockwave ring
      const shockwaveColor =
        activeScenarioRisk === 'CRITICAL'
          ? 'rgba(239, 68, 68, 0.85)'
          : activeScenarioRisk === 'HIGH'
          ? 'rgba(245, 158, 11, 0.85)'
          : 'rgba(52, 211, 153, 0.85)';

      shockwavesRef.current.push({
        radius: 10,
        maxRadius: 260,
        color: shockwaveColor,
        opacity: 0.9,
      });
    }
  }, [pulseTrigger, activeScenarioRisk]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Retina / High-DPI Display Scaling with dynamic center coordinates
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = rect.width || 540;
      const cssHeight = rect.height || 540;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);
      return {
        cssWidth,
        cssHeight,
        centerX: cssWidth / 2,
        centerY: cssHeight / 2,
      };
    };

    let { cssWidth, cssHeight, centerX, centerY } = updateSize();

    const handleResize = () => {
      const size = updateSize();
      cssWidth = size.cssWidth;
      cssHeight = size.cssHeight;
      centerX = size.centerX;
      centerY = size.centerY;
    };
    window.addEventListener('resize', handleResize);

    // Generate 3D Spherical Nodes
    const numPoints = 130;
    const sphereRadius = 165;
    const points: Point3D[] = [];

    const palette = ['#38bdf8', '#818cf8', '#34d399', '#a78bfa', '#60a5fa'];
    for (let i = 0; i < numPoints; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();
      points.push({
        x: sphereRadius * Math.sin(theta) * Math.cos(phi),
        y: sphereRadius * Math.sin(theta) * Math.sin(phi),
        z: sphereRadius * Math.cos(theta),
        baseColor: palette[i % palette.length],
        size: Math.random() * 2.2 + 1.2,
      });
    }

    // Orbiting Data Packets on Inclined Equatorial Rings
    const orbitalPackets: OrbitalPacket[] = [
      { ringIndex: 0, angle: 0, speed: 0.022, color: '#38bdf8' },
      { ringIndex: 0, angle: Math.PI, speed: 0.022, color: '#34d399' },
      { ringIndex: 1, angle: Math.PI / 2, speed: -0.018, color: '#818cf8' },
      { ringIndex: 1, angle: (3 * Math.PI) / 2, speed: -0.018, color: '#f43f5e' },
      { ringIndex: 2, angle: 0.8, speed: 0.025, color: '#a78bfa' },
    ];

    let currentAngleX = 0;
    let currentAngleY = 0;

    // Mouse Interaction with tactile cursor state
    const onMouseDown = (e: MouseEvent) => {
      mouseRotationRef.current.isDragging = true;
      mouseRotationRef.current.lastX = e.clientX;
      mouseRotationRef.current.lastY = e.clientY;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grabbing';
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseRotationRef.current.isDragging) {
        // Subtle tilt velocity bias towards mouse
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
        const my = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
        mouseRotationRef.current.velY = 0.005 + mx * 0.004;
        mouseRotationRef.current.velX = 0.002 + my * 0.003;
        return;
      }
      const dx = e.clientX - mouseRotationRef.current.lastX;
      const dy = e.clientY - mouseRotationRef.current.lastY;
      mouseRotationRef.current.velY = dx * 0.006;
      mouseRotationRef.current.velX = dy * 0.006;
      mouseRotationRef.current.lastX = e.clientX;
      mouseRotationRef.current.lastY = e.clientY;
    };

    const onMouseUp = () => {
      mouseRotationRef.current.isDragging = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    // Mobile / Tablet Touch Drag Support (passive: true preserves pan-y vertical scrolling)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        mouseRotationRef.current.isDragging = true;
        mouseRotationRef.current.lastX = e.touches[0].clientX;
        mouseRotationRef.current.lastY = e.touches[0].clientY;
        if (containerRef.current) {
          containerRef.current.style.cursor = 'grabbing';
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!mouseRotationRef.current.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - mouseRotationRef.current.lastX;
      const dy = e.touches[0].clientY - mouseRotationRef.current.lastY;
      mouseRotationRef.current.velY = dx * 0.006;
      mouseRotationRef.current.velX = dy * 0.006;
      mouseRotationRef.current.lastX = e.touches[0].clientX;
      mouseRotationRef.current.lastY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      mouseRotationRef.current.isDragging = false;
      if (containerRef.current) {
        containerRef.current.style.cursor = 'grab';
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    const fov = 400;

    const render = () => {
      // Dynamic center recalculation to prevent any center drift during resize or orientation changes
      const curCenterX = centerX;
      const curCenterY = centerY;

      ctx.clearRect(0, 0, cssWidth, cssHeight);

      if (!isReducedMotion) {
        currentAngleX = mouseRotationRef.current.velX;
        currentAngleY = mouseRotationRef.current.velY;
        // Friction decay on dragged velocity
        if (!mouseRotationRef.current.isDragging) {
          mouseRotationRef.current.velX += (0.002 - mouseRotationRef.current.velX) * 0.03;
          mouseRotationRef.current.velY += (0.005 - mouseRotationRef.current.velY) * 0.03;
        }
      } else {
        currentAngleX = 0;
        currentAngleY = 0;
      }

      // Rotate 3D Points
      const cosY = Math.cos(currentAngleY);
      const sinY = Math.sin(currentAngleY);
      const cosX = Math.cos(currentAngleX);
      const sinX = Math.sin(currentAngleX);

      const projectedPoints: { x: number; y: number; z: number; projX: number; projY: number; scale: number; alpha: number; color: string; size: number }[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // Rotate Y
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;

        // Rotate X
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        p.x = x1;
        p.y = y2;
        p.z = z2;

        const scale = fov / (fov + p.z);
        const projX = p.x * scale + curCenterX;
        const projY = p.y * scale + curCenterY;
        const alpha = Math.max(0.12, Math.min(1, (p.z + sphereRadius) / (2 * sphereRadius)));

        projectedPoints.push({
          x: p.x,
          y: p.y,
          z: p.z,
          projX,
          projY,
          scale,
          alpha,
          color: p.baseColor,
          size: p.size,
        });
      }

      // Sort points by Z (render back to front)
      projectedPoints.sort((a, b) => a.z - b.z);

      // Render Geodesic Synaptic Lattice (filaments between nearby points)
      ctx.lineWidth = 0.75;
      for (let i = 0; i < projectedPoints.length; i++) {
        for (let j = i + 1; j < projectedPoints.length; j++) {
          const p1 = projectedPoints[i];
          const p2 = projectedPoints[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dz = p1.z - p2.z;
          const dist3d = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist3d < 52) {
            const lineAlpha = (1 - dist3d / 52) * Math.min(p1.alpha, p2.alpha) * 0.38;
            ctx.strokeStyle = p1.color;
            ctx.globalAlpha = lineAlpha;
            ctx.beginPath();
            ctx.moveTo(p1.projX, p1.projY);
            ctx.lineTo(p2.projX, p2.projY);
            ctx.stroke();
          }
        }
      }

      // Render 3D Inclined Orbit Rings
      const ringRadius = sphereRadius * 1.25;
      const numRingSteps = 72;
      const rings = [
        { inclination: 0.35, azim: 0.2, color: 'rgba(56, 189, 248, 0.22)' },
        { inclination: -0.45, azim: 0.8, color: 'rgba(129, 140, 248, 0.22)' },
        { inclination: 0.9, azim: -0.4, color: 'rgba(52, 211, 153, 0.18)' },
      ];

      rings.forEach((ring, ringIdx) => {
        ctx.beginPath();
        let first = true;
        for (let s = 0; s <= numRingSteps; s++) {
          const theta = (s / numRingSteps) * Math.PI * 2;
          let rx = ringRadius * Math.cos(theta);
          let ry = ringRadius * Math.sin(theta) * Math.sin(ring.inclination);
          let rz = ringRadius * Math.sin(theta) * Math.cos(ring.inclination);

          // Apply current rotation to ring
          const rx1 = rx * cosY + rz * sinY;
          const rz1 = -rx * sinY + rz * cosY;
          const ry2 = ry * cosX - rz1 * sinX;
          const rz2 = ry * sinX + rz1 * cosX;

          const rScale = fov / (fov + rz2);
          const rpx = rx1 * rScale + curCenterX;
          const rpy = ry2 * rScale + curCenterY;

          if (first) {
            ctx.moveTo(rpx, rpy);
            first = false;
          } else {
            ctx.lineTo(rpx, rpy);
          }
        }
        ctx.strokeStyle = ring.color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Render Orbiting Satellite Packets for this ring
        orbitalPackets
          .filter((pkt) => pkt.ringIndex === ringIdx)
          .forEach((pkt) => {
            if (!isReducedMotion) {
              pkt.angle += pkt.speed;
            }
            let px = ringRadius * Math.cos(pkt.angle);
            let py = ringRadius * Math.sin(pkt.angle) * Math.sin(ring.inclination);
            let pz = ringRadius * Math.sin(pkt.angle) * Math.cos(ring.inclination);

            const px1 = px * cosY + pz * sinY;
            const pz1 = -px * sinY + pz * cosY;
            const py2 = py * cosX - pz1 * sinX;
            const pz2 = py * sinX + pz1 * cosX;

            const pScale = fov / (fov + pz2);
            const packetX = px1 * pScale + curCenterX;
            const packetY = py2 * pScale + curCenterY;

            ctx.beginPath();
            ctx.arc(packetX, packetY, 3.2 * pScale, 0, Math.PI * 2);
            ctx.fillStyle = pkt.color;
            ctx.globalAlpha = Math.max(0.3, (pz2 + ringRadius) / (2 * ringRadius));
            ctx.shadowColor = pkt.color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.shadowBlur = 0;
          });
      });

      // Render 3D Spherical Nodes (Optimized: only apply shadowBlur to foreground nodes where p.z > 40)
      for (const p of projectedPoints) {
        ctx.beginPath();
        const nodeRadius = Math.max(1, p.size * p.scale);
        ctx.arc(p.projX, p.projY, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;

        if (p.z > 40) {
          ctx.shadowBlur = 12 * p.scale;
          ctx.shadowColor = p.color;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Render Propagating Shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.radius += 5.5;
        sw.opacity *= 0.94;

        if (sw.radius >= sw.maxRadius || sw.opacity <= 0.02) {
          shockwavesRef.current.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(curCenterX, curCenterY, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 2.5 * (1 - sw.radius / sw.maxRadius);
        ctx.globalAlpha = sw.opacity;
        ctx.shadowBlur = 16;
        ctx.shadowColor = sw.color;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`holographic-core-3d-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 580,
        height: 520,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Touch handling: pan-y ensures mobile touch vertical scroll is not blocked
        touchAction: 'pan-y',
        cursor: 'grab',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'pan-y',
        }}
      />
      {/* Central Volumetric Core Glow */}
      <div
        className="core-ambient-aura"
        style={{
          position: 'absolute',
          inset: '16%',
          borderRadius: '50%',
          background:
            activeScenarioRisk === 'CRITICAL'
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.22) 0%, rgba(99, 102, 241, 0.12) 45%, transparent 70%)'
              : activeScenarioRisk === 'HIGH'
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(59, 130, 246, 0.12) 45%, transparent 70%)'
              : 'radial-gradient(circle, rgba(56, 189, 248, 0.24) 0%, rgba(52, 211, 153, 0.14) 45%, transparent 70%)',
          filter: 'blur(45px)',
          pointerEvents: 'none',
          transition: 'background 0.5s ease',
          zIndex: 0,
        }}
      />
    </div>
  );
};
