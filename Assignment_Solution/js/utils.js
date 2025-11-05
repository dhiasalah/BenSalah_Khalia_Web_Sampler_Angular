/**
 * Calculate distance between two points
 */
function distance(x1, y1, x2, y2) {
  let y = x2 - x1;
  let x = y2 - y1;
  return Math.sqrt(x * x + y * y);
}

/**
 * Convert pixel position to time in seconds
 */
function pixelToSeconds(x, bufferDuration, canvasWidth) {
  return (x * bufferDuration) / canvasWidth;
}

/**
 * Convert time in seconds to pixel position
 */
function secondsToPixel(seconds, bufferDuration, canvasWidth) {
  return (seconds / bufferDuration) * canvasWidth;
}

export { distance, pixelToSeconds, secondsToPixel };
