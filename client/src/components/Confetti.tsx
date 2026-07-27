import { useEffect, useRef, useState } from "react";

interface ConfettiProps {
  duration?: number; // milliseconds
  particleCount?: number;
}

export function Confetti({ duration = 6000, particleCount = 500 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to window size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rotation: number;
      rotationSpeed: number;
      color: string;
      life: number;
    }

    const particles: Particle[] = [];
    const colors = ["#d4af37", "#ffd700", "#ffed4e", "#ffa500", "#ff6b6b"];

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Create particles bursting outwards across the entire screen layout
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      
      // Increased force limits (10 to 28) so particles rocket out to the screen edges
      const force = Math.random() * 18 + 10; 

      particles.push({
        // Slightly offset the spawn point from the dead center so it's a volumetric burst
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * force, 
        vy: Math.sin(angle) * force - 4, // Slight upward bias to combat instant gravity drop
        size: Math.random() * 8 + 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      for (const particle of particles) {
        // Reduced friction (from 0.95 to 0.975) so they retain speed and travel further
        particle.vx *= 0.975;
        particle.vy *= 0.975;

        // Apply gravity
        particle.vy += 0.15;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Update rotation
        particle.rotation += particle.rotationSpeed;

        // Fade out
        particle.life = Math.max(0, 1 - progress);

        // Draw particle
        ctx.save();
        ctx.globalAlpha = particle.life;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);

        // Draw square confetti
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);

        ctx.restore();
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [duration, particleCount]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh" }}
    />
  );
}

// Hook to trigger confetti
export function useConfetti() {
  const [showConfetti, setShowConfetti] = useState(false);

  const trigger = (duration = 6000) => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), duration);
  };

  return { showConfetti, trigger };
}