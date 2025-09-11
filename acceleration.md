Current (quadratic):
  currentDistance = timeRatio * timeRatio * maxDistance; // x²

  More dramatic options:

  1. Cubic (x³) - More dramatic:
  currentDistance = timeRatio * timeRatio * timeRatio * maxDistance; // x³

  2. Quartic (x⁴) - Very dramatic:
  currentDistance = Math.pow(timeRatio, 4) * maxDistance; // x⁴

  3. Exponential - Extremely dramatic:
  // Cards barely move for most of the time, then explode outward
  currentDistance = (Math.exp(timeRatio * 3) - 1) / (Math.exp(3) - 1) * maxDistance;

  4. Custom exponential with adjustable intensity:
  const intensity = 5; // Higher = more dramatic
  currentDistance = (Math.pow(timeRatio, intensity)) * maxDistance;

  5. Smooth exponential transition:
  // Very slow start, then rapid acceleration
  currentDistance = (Math.exp(timeRatio * 4) - 1) / (Math.exp(4) - 1) * maxDistance;

  Comparison at 50% time:
  - Quadratic (x²): 25% distance
  - Cubic (x³): 12.5% distance
  - Exponential: ~2% distance
  - x⁵: 3.125% distance

  My recommendation: Try the cubic first (timeRatio³) for a noticeable improvement, or the custom exponential with intensity = 4 for a very
  dramatic starfield effect where cards barely crawl at first, then zoom out rapidly.