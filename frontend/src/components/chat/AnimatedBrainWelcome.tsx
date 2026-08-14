import React, { useState } from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';

interface AnimatedBrainWelcomeProps {
  onQuickPrompt: (prompt: string) => void;
}

export const AnimatedBrainWelcome: React.FC<AnimatedBrainWelcomeProps> = ({ onQuickPrompt }) => {
  const [isWaving, setIsWaving] = useState(false);

  const handleMascotClick = () => {
    setIsWaving(true);
    setTimeout(() => setIsWaving(false), 1200);
  };

  return (
    <div className="mascot-welcome-container anim-scale-in">
      {/* ── Single Welcome Comment Speech Bubble ── */}
      <div className="mascot-speech-bubble">
        <span>👋 Welcome to a new conversation! How can I help?</span>
      </div>

      {/* ── Vintage Cartoon Brain Mascot Character ── */}
      <div
        className={`mascot-stage ${isWaving ? 'is-interacting' : ''}`}
        onClick={handleMascotClick}
        title="Click me for an idea!"
      >
        {/* Floating Idea Sparkle above pointing finger */}
        <div className="mascot-idea-spark">
          <Sparkles size={18} className="idea-spark-icon" />
        </div>

        {/* Mascot SVG Vector Illustration */}
        <svg
          className="mascot-brain-svg"
          viewBox="0 0 320 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Soft Shadow for Brain Surface */}
            <radialGradient id="brainShadowGrad" cx="50%" cy="40%" r="60%">
              <stop offset="60%" stopColor="#f8a5b0" />
              <stop offset="100%" stopColor="#e27c8b" />
            </radialGradient>

            <linearGradient id="shoeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="70%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>

            <filter id="mascotGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="rgba(244, 151, 165, 0.25)" />
            </filter>
          </defs>

          {/* 1. Ground Drop Shadow (Scales with Bobbing) */}
          <ellipse
            cx="160"
            cy="295"
            rx="65"
            ry="11"
            fill="#090d16"
            className="mascot-ground-shadow"
          />

          {/* ── Mascot Body Group (Bobs and Bounces) ── */}
          <g className="mascot-body-group">
            {/* 2. Legs */}
            {/* Left Leg (Viewer's Left) */}
            <path
              d="M 135 210 Q 128 238 122 258"
              stroke="#0f172a"
              strokeWidth="11"
              strokeLinecap="round"
            />
            {/* Right Leg (Viewer's Right) */}
            <path
              d="M 185 210 Q 192 238 198 258"
              stroke="#0f172a"
              strokeWidth="11"
              strokeLinecap="round"
            />

            {/* 3. Shoes */}
            {/* Left Shoe */}
            <g className="mascot-shoe left-shoe">
              {/* Sole */}
              <path
                d="M 85 278 C 85 270, 110 262, 142 262 C 158 262, 164 270, 164 278 C 164 286, 145 292, 122 292 C 98 292, 85 286, 85 278 Z"
                fill="#0f172a"
              />
              {/* Shoe Body */}
              <path
                d="M 90 274 C 90 252, 110 244, 132 244 C 152 244, 160 256, 160 274 C 160 282, 145 286, 128 286 C 105 286, 90 282, 90 274 Z"
                fill="url(#shoeGrad)"
                stroke="#0f172a"
                strokeWidth="4"
              />
              {/* White Shoe Collar Cuff */}
              <ellipse
                cx="122"
                cy="252"
                rx="15"
                ry="7"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="3.5"
              />
            </g>

            {/* Right Shoe */}
            <g className="mascot-shoe right-shoe">
              {/* Sole */}
              <path
                d="M 158 278 C 158 270, 180 262, 215 262 C 232 262, 238 270, 238 278 C 238 286, 220 292, 198 292 C 174 292, 158 286, 158 278 Z"
                fill="#0f172a"
              />
              {/* Shoe Body */}
              <path
                d="M 162 274 C 162 252, 182 244, 208 244 C 228 244, 234 256, 234 274 C 234 282, 218 286, 202 286 C 180 286, 162 282, 162 274 Z"
                fill="url(#shoeGrad)"
                stroke="#0f172a"
                strokeWidth="4"
              />
              {/* White Shoe Collar Cuff */}
              <ellipse
                cx="198"
                cy="252"
                rx="15"
                ry="7"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="3.5"
              />
            </g>

            {/* 4. Left Hand & Arm (On Hip - Viewer's Right) */}
            <g className="mascot-arm-left">
              {/* Arm */}
              <path
                d="M 230 148 Q 268 168 245 204"
                stroke="#0f172a"
                strokeWidth="11"
                strokeLinecap="round"
                fill="none"
              />
              {/* Glove Cuff */}
              <path
                d="M 234 196 C 234 190, 252 192, 256 198 C 258 204, 244 210, 236 204 Z"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="3.5"
              />
              {/* Glove Hand (Resting on Hip) */}
              <path
                d="M 238 200 C 252 195, 268 205, 268 220 C 268 232, 255 244, 240 242 C 228 240, 222 228, 224 218 C 226 208, 232 202, 238 200 Z"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="4"
              />
              {/* Glove Knuckle Lines */}
              <path d="M 248 215 C 254 218, 256 226, 252 232" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 240 220 C 244 224, 245 230, 242 235" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
            </g>

            {/* 5. Right Hand & Arm (Pointing Up - Viewer's Left) */}
            <g className="mascot-arm-right">
              {/* Arm */}
              <path
                d="M 90 145 Q 60 110 75 75"
                stroke="#0f172a"
                strokeWidth="11"
                strokeLinecap="round"
                fill="none"
              />
              {/* Glove Cuff */}
              <ellipse
                cx="76"
                cy="76"
                rx="11"
                ry="6"
                transform="rotate(-25 76 76)"
                fill="#ffffff"
                stroke="#0f172a"
                strokeWidth="3.5"
              />
              {/* Pointing Hand Glove */}
              <g className="mascot-pointing-hand">
                {/* Fist Base */}
                <path
                  d="M 66 72 C 58 64, 62 48, 76 46 C 84 45, 92 50, 95 60 C 97 70, 90 82, 78 82 C 70 82, 66 76, 66 72 Z"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="3.5"
                />
                {/* Pointing Index Finger */}
                <path
                  d="M 82 50 L 86 18 C 86 12, 98 12, 98 18 L 95 50 Z"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {/* Thumb Fold */}
                <path
                  d="M 70 60 C 64 54, 60 58, 64 66 C 68 74, 76 72, 78 68"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="3"
                />
                {/* Folded Fingers Creases */}
                <path d="M 80 58 Q 88 60 90 66" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 76 66 Q 84 68 86 74" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>

            {/* 6. Main Brain Silhouette (Pink Lobe Curves) */}
            <g className="mascot-brain-head" filter="url(#mascotGlow)">
              <path
                d="M 100 185
                   C 82 188, 68 178, 65 162
                   C 60 148, 68 135, 66 122
                   C 64 105, 75 92, 88 85
                   C 95 72, 112 60, 130 62
                   C 142 52, 162 50, 178 58
                   C 192 52, 215 54, 228 68
                   C 242 75, 254 90, 252 108
                   C 258 120, 262 135, 255 150
                   C 258 165, 248 182, 232 188
                   C 220 196, 202 195, 192 188
                   C 180 196, 160 198, 145 192
                   C 132 198, 115 195, 100 185 Z"
                fill="url(#brainShadowGrad)"
                stroke="#0f172a"
                strokeWidth="5"
                strokeLinejoin="round"
              />

              {/* Brain Folds / Gyri (Black Cartoon Contours) */}
              <g stroke="#0f172a" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
                {/* Top Forehead Folds */}
                <path d="M 125 65 C 130 78, 142 84, 155 78" />
                <path d="M 165 60 C 172 74, 185 76, 195 70" />
                <path d="M 205 66 C 215 80, 228 82, 238 78" />

                {/* Left Side Folds */}
                <path d="M 88 95 C 96 104, 98 116, 90 128" />
                <path d="M 72 130 C 82 135, 88 145, 80 156" />
                <path d="M 95 162 C 105 168, 110 178, 106 186" />

                {/* Right Side Folds */}
                <path d="M 235 95 C 226 105, 228 118, 238 125" />
                <path d="M 245 138 C 235 145, 234 158, 242 168" />
                <path d="M 222 170 C 215 178, 218 188, 226 192" />

                {/* Center / Crown Folds */}
                <path d="M 152 82 C 158 98, 172 102, 182 95" />
                <path d="M 188 98 C 196 112, 210 115, 218 108" />
                <path d="M 132 90 C 122 102, 126 118, 138 124" />
                <path d="M 205 125 C 216 138, 212 152, 202 160" />
                <path d="M 138 170 C 145 178, 155 180, 164 174" />
                <path d="M 172 174 C 180 182, 190 182, 196 176" />
              </g>

              {/* 7. Face (Eyes, Eyebrows, Nose, Smile) */}
              <g className="mascot-face">
                {/* Eyebrows */}
                <path
                  d="M 125 108 C 132 100, 144 102, 150 108"
                  stroke="#0f172a"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 166 106 C 174 98, 188 100, 194 106"
                  stroke="#0f172a"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Left Eye */}
                <g className="mascot-eye left-mascot-eye">
                  <ellipse
                    cx="138"
                    cy="130"
                    rx="14"
                    ry="20"
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth="4"
                  />
                  {/* Pupil */}
                  <ellipse
                    cx="142"
                    cy="130"
                    rx="9"
                    ry="13"
                    fill="#0f172a"
                    className="mascot-pupil"
                  />
                  {/* Catchlights */}
                  <circle cx="140" cy="124" r="3.5" fill="#ffffff" />
                  <circle cx="145" cy="133" r="1.8" fill="#ffffff" />
                </g>

                {/* Right Eye */}
                <g className="mascot-eye right-mascot-eye">
                  <ellipse
                    cx="180"
                    cy="128"
                    rx="14"
                    ry="20"
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth="4"
                  />
                  {/* Pupil */}
                  <ellipse
                    cx="184"
                    cy="128"
                    rx="9"
                    ry="13"
                    fill="#0f172a"
                    className="mascot-pupil"
                  />
                  {/* Catchlights */}
                  <circle cx="182" cy="122" r="3.5" fill="#ffffff" />
                  <circle cx="187" cy="131" r="1.8" fill="#ffffff" />
                </g>

                {/* Pink Button Nose */}
                <path
                  d="M 158 142 C 160 148, 168 148, 170 142"
                  stroke="#0f172a"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Big Happy Smile with Tongue */}
                <g className="mascot-smile">
                  {/* Smile Cavity */}
                  <path
                    d="M 144 154 C 144 175, 176 175, 176 154 Z"
                    fill="#0f172a"
                    stroke="#0f172a"
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Pink Tongue */}
                  <path
                    d="M 152 165 C 156 158, 164 158, 168 165 C 165 174, 155 174, 152 165 Z"
                    fill="#f472b6"
                  />
                  {/* Smile Corner Creases */}
                  <path d="M 140 152 C 142 156, 144 158, 146 154" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <path d="M 180 152 C 178 156, 176 158, 174 154" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none" />
                </g>

                {/* Cute Rosy Cheeks */}
                <ellipse cx="124" cy="148" rx="7" ry="4" fill="rgba(239, 68, 68, 0.25)" />
                <ellipse cx="196" cy="146" rx="7" ry="4" fill="rgba(239, 68, 68, 0.25)" />
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
