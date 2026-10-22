// Estados de relleno (cargando / vacío / error) para <tbody> y contenedores de lista.

export function setTableMessage(tbody, colSpan, text) {
  if (!tbody) return;
  const cell = document.createElement('td');
  cell.colSpan = colSpan;
  cell.className = 'table-empty-cell';
  cell.textContent = text;
  const row = document.createElement('tr');
  row.append(cell);
  tbody.replaceChildren(row);
}

export function setListMessage(container, text) {
  if (!container) return;
  const empty = document.createElement('div');
  empty.className = 'summary-empty';
  empty.textContent = text;
  container.replaceChildren(empty);
}

export function normalizeList(data) {
  return Array.isArray(data) ? data : (data?.items || []);
}
