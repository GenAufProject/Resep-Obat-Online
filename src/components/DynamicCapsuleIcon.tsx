import React from "react";

export const DynamicCapsuleIcon: React.FC = () => {
  const slices = Array.from({ length: 12 }, (_, i) => i);
  const domeRotations = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className="capsule-wrapper" id="dynamic-capsule-logo">
      <style>{`
        .capsule-wrapper {
          width: 50px;
          height: 60px;
          perspective: 250px;
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
          pointer-events: none;
        }

        .capsule-3d {
          width: 20px;
          height: 48px;
          position: relative;
          transform-style: preserve-3d;
          animation: capsule-orbit 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes capsule-orbit {
          0% {
            transform: rotateX(-15deg) rotateY(0deg) rotateZ(-12deg);
          }
          50% {
            transform: rotateX(20deg) rotateY(180deg) rotateZ(12deg);
          }
          100% {
            transform: rotateX(-15deg) rotateY(360deg) rotateZ(-12deg);
          }
        }

        /* Half Capsules */
        .half-capsule {
          position: absolute;
          width: 20px;
          height: 24px;
          left: 0;
          transform-style: preserve-3d;
        }

        .half-capsule.top {
          top: 0px;
        }

        .half-capsule.bottom {
          top: 24px;
        }

        /* 3D Cylinder Facets */
        .cylinder-facet {
          position: absolute;
          width: 5.8px;
          height: 14px;
          left: 7.1px;
          transform-style: preserve-3d;
          backface-visibility: visible;
        }

        .top .cylinder-facet {
          top: 10px; /* middle portion of top half */
          background: linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(0,0,0,0.15) 100%), #07575b;
          border-left: 0.5px solid rgba(255, 255, 255, 0.05);
          border-right: 0.5px solid rgba(0, 0, 0, 0.1);
        }

        .bottom .cylinder-facet {
          top: 0px; /* middle portion of bottom half */
          background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0.15) 100%), #ec92b5;
          border-left: 0.5px solid rgba(255, 255, 255, 0.1);
          border-right: 0.5px solid rgba(0, 0, 0, 0.1);
        }

        /* 3D Dome Semicircles (forming realistic sphere caps) */
        .dome-semicircle {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          left: 0;
          backface-visibility: visible;
        }

        .top .dome-semicircle {
          top: 0px;
          clip-path: polygon(0 0, 100% 0, 100% 50%, 0 50%);
          background: radial-gradient(circle at 30% 30%, #0c757a 0%, #07575b 60%, #033c3f 100%);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .bottom .dome-semicircle {
          top: 4px;
          clip-path: polygon(0 50%, 100% 50%, 100% 100%, 0 100%);
          background: radial-gradient(circle at 30% 70%, #f1a9c5 0%, #ec92b5 60%, #ca6e91 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }

        /* Joined Middle Seam Ring to look extremely high-fidelity */
        .seam-slice {
          position: absolute;
          width: 5.9px;
          height: 1.5px;
          left: 7.05px;
          top: -0.75px;
          background: #003b46;
          opacity: 0.75;
          backface-visibility: visible;
        }

        /* Subtle 3D Shadow underneath */
        .capsule-shadow {
          position: absolute;
          width: 24px;
          height: 6px;
          background: rgba(0, 59, 70, 0.15);
          filter: blur(3px);
          border-radius: 50%;
          bottom: -4px;
          transform: rotateX(80deg);
          animation: shadow-pulse 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @keyframes shadow-pulse {
          0%, 100% {
            transform: scale(1) rotateX(80deg);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.15) rotateX(80deg);
            opacity: 0.45;
          }
        }
      `}</style>

      <div className="capsule-3d">
        {/* Top Half of Capsule (Teal #07575b) */}
        <div className="half-capsule top">
          {slices.map((i) => (
            <div
              key={`top-cyl-${i}`}
              className="cylinder-facet"
              style={{
                transform: `rotateY(${i * 30}deg) translateZ(9.6px)`,
              }}
            />
          ))}
          {domeRotations.map((i) => (
            <div
              key={`top-dome-${i}`}
              className="dome-semicircle"
              style={{
                transform: `rotateY(${i * 22.5}deg)`,
              }}
            />
          ))}
        </div>

        {/* Joining seam rim in the center */}
        {slices.map((i) => (
          <div
            key={`seam-${i}`}
            className="seam-slice"
            style={{
              transform: `rotateY(${i * 30}deg) translateZ(9.8px)`,
            }}
          />
        ))}

        {/* Bottom Half of Capsule (Pink #ec92b5) */}
        <div className="half-capsule bottom">
          {slices.map((i) => (
            <div
              key={`bot-cyl-${i}`}
              className="cylinder-facet"
              style={{
                transform: `rotateY(${i * 30}deg) translateZ(9.6px)`,
              }}
            />
          ))}
          {domeRotations.map((i) => (
            <div
              key={`bot-dome-${i}`}
              className="dome-semicircle"
              style={{
                transform: `rotateY(${i * 22.5}deg)`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Weightless shadow under the orbiting capsule */}
      <div className="capsule-shadow" />
    </div>
  );
};
