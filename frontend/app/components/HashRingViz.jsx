'use client';

import { useEffect, useMemo, useState } from 'react';
import { colorForNode, COLORS } from '../lib/colors';

// Renders the consistent hashing ring as an SVG. Virtual nodes are plotted at
// their position (hash % MAX -> angle). When `keyHighlight` is provided we
// also draw a small marker for the key and a chord/arrow to the node it maps
// to so the user can see "this key lives on that node" intuitively.

export default function HashRingViz({ ring = [], nodes = [], keyHighlight = null, replicationFactor = 1, migrations = [] }) {
  const SIZE = 420;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const R = 165;

  // Trail effect when a new key is mapped: pulse animation triggered via key change.
  const [pulseId, setPulseId] = useState(0);
  useEffect(() => {
    if (keyHighlight) setPulseId((p) => p + 1);
  }, [keyHighlight && keyHighlight.key, keyHighlight && keyHighlight.angle]);

  const nodeAnchor = useMemo(() => {
    // Pick first virtual node entry per real node as the visual anchor for labels.
    const m = new Map();
    for (const e of ring) {
      if (!m.has(e.nodeId)) m.set(e.nodeId, e);
    }
    return m;
  }, [ring]);

  function pointAt(angleDeg, radius = R) {
    const a = (angleDeg - 90) * (Math.PI / 180); // start at top
    return [CX + radius * Math.cos(a), CY + radius * Math.sin(a)];
  }

  const keyPoint = keyHighlight ? pointAt(keyHighlight.angle, R + 26) : null;
  const targetAnchor =
    keyHighlight && nodeAnchor.get(keyHighlight.primary)
      ? nodeAnchor.get(keyHighlight.primary)
      : null;
  const targetPoint = targetAnchor ? pointAt(targetAnchor.angle, R) : null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center" data-testid="hash-ring-viz">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[460px] h-auto">
        <defs>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(51,102,255,0.05)" />
            <stop offset="80%" stopColor="rgba(51,102,255,0)" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R + 60} fill="url(#ringGlow)" />

        {/* Outer faint ring */}
        <circle cx={CX} cy={CY} r={R + 18} fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 6" />

        {/* The actual ring */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* Tick marks every 30deg */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = i * 30;
          const [x1, y1] = pointAt(a, R - 6);
          const [x2, y2] = pointAt(a, R + 6);
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" />
          );
        })}

        {/* Virtual nodes (small dots) */}
        {ring.map((e, idx) => {
          const [x, y] = pointAt(e.angle, R);
          const c = colorForNode(e.nodeId);
          return (
            <circle
              key={`vn-${idx}`}
              cx={x}
              cy={y}
              r={2}
              fill={c}
              opacity={0.7}
            />
          );
        })}

        {/* Real node anchors (larger labelled dots) */}
        {Array.from(nodeAnchor.entries()).map(([nodeId, e], idx, arr) => {
          const [x, y] = pointAt(e.angle, R);
          // Label at evenly-spaced angular positions to avoid overlap when
          // multiple real nodes happen to have nearby virtual-node anchors.
          const labelAngle = (idx / arr.length) * 360;
          const [lx, ly] = pointAt(labelAngle, R + 36);
          const c = colorForNode(nodeId);
          const isTarget = keyHighlight && keyHighlight.primary === nodeId;
          return (
            <g key={nodeId}>
              <line
                x1={x}
                y1={y}
                x2={lx}
                y2={ly}
                stroke={c}
                strokeWidth="1"
                opacity="0.35"
              />
              <circle
                cx={x}
                cy={y}
                r={isTarget ? 9 : 6}
                fill={c}
                stroke="#0A0A0A"
                strokeWidth="2"
                style={{
                  filter: isTarget ? `drop-shadow(0 0 8px ${c})` : 'none',
                  transition: 'r 200ms ease',
                }}
              />
              <rect
                x={lx - 26}
                y={ly - 8}
                width="52"
                height="16"
                fill="#0A0A0A"
                stroke={c}
                strokeWidth="1"
              />
              <text
                x={lx}
                y={ly}
                fill="rgba(255,255,255,0.95)"
                fontSize="10"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="ui-monospace, monospace"
                fontWeight={isTarget ? 'bold' : 'normal'}
              >
                {nodeId}
              </text>
            </g>
          );
        })}

        {/* Highlighted key + chord */}
        {keyPoint && targetPoint && (
          <g key={pulseId}>
            <line
              x1={keyPoint[0]}
              y1={keyPoint[1]}
              x2={targetPoint[0]}
              y2={targetPoint[1]}
              stroke={COLORS.primary}
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.9"
            >
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
            </line>
            <circle
              cx={keyPoint[0]}
              cy={keyPoint[1]}
              r="6"
              fill={COLORS.primary}
              style={{ filter: `drop-shadow(0 0 8px ${COLORS.primary})` }}
            >
              <animate attributeName="r" values="3;8;3" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <text
              x={keyPoint[0]}
              y={keyPoint[1] - 12}
              fill="white"
              fontSize="11"
              textAnchor="middle"
              fontFamily="ui-monospace, monospace"
            >
              {keyHighlight.key}
            </text>
          </g>
        )}

        {/* Animated key migrations across the ring */}
        {migrations.map((m) => {
          if (m.fromAngle == null || m.toAngle == null) return null;
          const [sx, sy] = pointAt(m.fromAngle, R);
          const [ex, ey] = pointAt(m.toAngle, R);
          // Curve mid-point pulled toward center for a graceful arc.
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2;
          const dx = mx - CX;
          const dy = my - CY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const cx = CX + dx * 0.25; // pull arc inward
          const cy = CY + dy * 0.25;
          const path = `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}`;
          const fromColor = colorForNode(m.from);
          const toColor = colorForNode(m.to);
          const dur = '900ms';
          return (
            <g key={m.id} style={{ pointerEvents: 'none' }}>
              <path
                d={path}
                fill="none"
                stroke={toColor}
                strokeWidth="1"
                strokeDasharray="3 4"
                opacity="0.45"
              >
                <animate attributeName="opacity" values="0.6;0" dur={dur} fill="freeze" />
              </path>
              <circle r="4" fill={fromColor} stroke="white" strokeWidth="1" style={{ filter: `drop-shadow(0 0 6px ${fromColor})` }}>
                <animateMotion dur={dur} repeatCount="1" fill="freeze" path={path} />
                <animate attributeName="fill" from={fromColor} to={toColor} dur={dur} fill="freeze" />
              </circle>
              <text
                fill="white"
                fontSize="9"
                textAnchor="middle"
                dy="-8"
                fontFamily="ui-monospace, monospace"
                opacity="0.85"
              >
                <animateMotion dur={dur} repeatCount="1" fill="freeze" path={path} />
                <animate attributeName="opacity" values="1;0" dur={dur} fill="freeze" />
                {m.key}
              </text>
            </g>
          );
        })}

        <text
          x={CX}
          y={CY - 6}
          fill="rgba(255,255,255,0.5)"
          fontSize="10"
          textAnchor="middle"
          letterSpacing="0.2em"
          fontFamily="ui-monospace, monospace"
        >
          CONSISTENT HASH RING
        </text>
        <text
          x={CX}
          y={CY + 14}
          fill="white"
          fontSize="22"
          textAnchor="middle"
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
        >
          {nodes.length} NODES
        </text>
        <text
          x={CX}
          y={CY + 32}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="middle"
          fontFamily="ui-monospace, monospace"
        >
          RF={replicationFactor} · {ring.length} vnodes
        </text>
      </svg>
    </div>
  );
}
