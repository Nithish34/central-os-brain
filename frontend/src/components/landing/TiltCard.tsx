import React, { useRef, useEffect } from 'react';

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  maxTilt?: number;
  perspective?: number;
  glareOpacity?: number;
  borderRadius?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  className = '',
  style,
  maxTilt = 7,
  perspective = 1000,
  glareOpacity = 0.22,
  borderRadius = '16px',
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const glareRef = useRef<HTMLDivElement | null>(null);
  const isReducedMotion = useRef<boolean>(false);
  const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    isReducedMotion.current = mediaQuery.matches;

    const handler = (e: MediaQueryListEvent) => {
      isReducedMotion.current = e.matches;
      if (e.matches && cardRef.current) {
        cardRef.current.style.transform = 'none';
        if (glareRef.current) glareRef.current.style.opacity = '0';
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      mediaQuery.removeEventListener('change', handler);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isReducedMotion.current || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTilt;
    const rotateY = ((x - centerX) / centerX) * maxTilt;

    // Direct DOM manipulation - 0 React re-renders, 60fps smooth
    cardRef.current.style.transform = `perspective(${perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;

    if (glareRef.current) {
      const px = ((x / rect.width) * 100).toFixed(1);
      const py = ((y / rect.height) * 100).toFixed(1);
      glareRef.current.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(255, 255, 255, 0.35) 0%, transparent 65%)`;
      glareRef.current.style.opacity = `${glareOpacity}`;
    }
  };

  const handleMouseEnter = () => {
    // Clear any pending mouse-leave reset timer when cursor re-enters rapidly
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (isReducedMotion.current || !cardRef.current) return;
    cardRef.current.style.transition = 'transform 0.08s ease-out';
  };

  const handleMouseLeave = () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (isReducedMotion.current || !cardRef.current) return;

    cardRef.current.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    cardRef.current.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';

    if (glareRef.current) {
      glareRef.current.style.opacity = '0';
    }

    // Reset transition so next mousemove is instant without drag latency
    resetTimerRef.current = setTimeout(() => {
      if (cardRef.current) {
        cardRef.current.style.transition = 'transform 0.08s ease-out';
      }
      resetTimerRef.current = null;
    }, 450);
  };

  return (
    <div
      ref={cardRef}
      className={`tilt-card-wrapper ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      style={{
        position: 'relative',
        borderRadius,
        transformStyle: 'preserve-3d',
        WebkitTransformStyle: 'preserve-3d',
        // Safari fix: Do not set overflow: hidden on container so translateZ children don't flatten
        ...style,
      }}
    >
      {/* Specular Glare Overlay - clipped cleanly to card boundary */}
      <div
        ref={glareRef}
        className="tilt-glare-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius,
          overflow: 'hidden',
          pointerEvents: 'none',
          opacity: 0,
          transition: 'opacity 0.25s ease',
          zIndex: 3,
        }}
      />
      {/* Elevated Child Content */}
      <div
        className="tilt-card-content"
        style={{
          transform: 'translateZ(20px)',
          WebkitTransform: 'translateZ(20px)',
          zIndex: 1,
          height: '100%',
        }}
      >
        {children}
      </div>
    </div>
  );
};
