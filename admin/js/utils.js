export function formatNumber(num) {
  return Number(num || 0).toLocaleString('es-ES');
}

export function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Hace un momento';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'Hace unos segundos';
  if (diffSec < 3600) return `Hace ${Math.floor(diffSec / 60)} min`;
  if (diffSec < 86400) return `Hace ${Math.floor(diffSec / 3600)} h`;
  return `Hace ${Math.floor(diffSec / 86400)} d`;
}
