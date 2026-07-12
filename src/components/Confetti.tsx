import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: 'circle' | 'square' | 'triangle' | 'emoji';
  emoji?: string;
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
}

const COLORS = [
  '#FF1493', // Deep Pink
  '#FF69B4', // Hot Pink
  '#FFD700', // Gold
  '#00FF7F', // Spring Green
  '#00EEEE', // Cyan
  '#9370DB', // Medium Purple
  '#FF4500', // Orange Red
  '#4169E1', // Royal Blue
];

const EMOJIS = ['🎂', '💖', '⭐', '🎈', '🎉', '✨', '💐', '🥳'];

export const Confetti: React.FC<ConfettiProps> = ({ active, onComplete }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle factory
    const particles: Particle[] = [];

    // Create dual bottom-bursts (left and right corners) and a central burst for massive impact
    const createBurst = (startX: number, startY: number, angleRangeStart: number, angleRangeEnd: number, count: number) => {
      for (let i = 0; i < count; i++) {
        const angle = angleRangeStart + Math.random() * (angleRangeEnd - angleRangeStart);
        const velocity = 12 + Math.random() * 18; // strong upwards explosion speed
        const size = 8 + Math.random() * 12;
        const shapes: Particle['shape'][] = ['circle', 'square', 'triangle', 'emoji'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const emoji = shape === 'emoji' ? EMOJIS[Math.floor(Math.random() * EMOJIS.length)] : undefined;

        particles.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity, // negative since y-axis goes down
          color,
          size,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: -0.1 + Math.random() * 0.2,
          shape,
          emoji,
          opacity: 1,
          wobble: Math.random() * 10,
          wobbleSpeed: 0.05 + Math.random() * 0.08,
        });
      }
    };

    // Trigger three bursts: left-corner, right-corner, and center-bottom
    createBurst(0, height, -Math.PI / 6, -Math.PI / 3, 60); // burst up & right
    createBurst(width, height, -Math.PI * (2/3), -Math.PI * (5/6), 60); // burst up & left
    createBurst(width / 2, height, -Math.PI * 0.35, -Math.PI * 0.65, 80); // burst straight up

    // Gravity and physics constants
    const gravity = 0.35;
    const drag = 0.985;

    // Animation Loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      let aliveCount = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Apply physics
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;

        p.x += p.vx + Math.sin(p.wobble) * 0.5;
        p.y += p.vy;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed;

        // Gradual fade out as particles descend or go out of bounds
        if (p.y > height * 0.6) {
          p.opacity -= 0.008;
        }

        if (p.opacity <= 0) continue;

        aliveCount++;

        // Draw particle
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.shape === 'square') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === 'triangle') {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.shape === 'emoji' && p.emoji) {
          ctx.font = `${p.size * 1.6}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        }

        ctx.restore();
      }

      // Continue animation if particles are active
      if (aliveCount > 0) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Start loop
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [active, onComplete]);

  if (!active) return null;

  return (
    <canvas
      id="birthday-confetti-canvas"
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[9999]"
    />
  );
};
