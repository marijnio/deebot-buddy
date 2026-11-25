import React from 'react';

const VALID_MOODS = ['happy', 'normal', 'dusty', 'faint'];

/**
 * Renders the editable standalone SVG mascot from /mascots/<mood>.svg.
 * Designers can edit mascots/*.svg directly and reload without rebuilding.
 */
export default function RobotMascot({
  mood = 'happy',
  cacheBust = 0,
  className = 'w-44 h-44',
}) {
  const safeMood = VALID_MOODS.includes(mood) ? mood : 'happy';
  const query = cacheBust ? `?v=${cacheBust}` : '';

  return (
    <img
      src={`/mascots/${safeMood}.svg${query}`}
      alt={`Deebot Buddy mascot looking ${safeMood}`}
      className={`${className} object-contain select-none`}
      draggable={false}
    />
  );
}
