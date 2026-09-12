export default function DifficultyBadge({ rating }) {
  const rated = Number.isFinite(rating);
  return <span className={`rating-badge ${rated ? 'rating-badge--rated' : ''}`} title="Problem difficulty rating">
    {rated ? rating.toLocaleString() : 'Unrated'}
  </span>;
}
