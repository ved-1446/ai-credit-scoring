/**
 * csv.js — Client-side CSV generation and download utility with robust quote escaping.
 */

export function exportToCSV(filename, columns, rows) {
  if (!rows || !rows.length) return;

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Replace double quotes with two double quotes, and wrap in double quotes
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headerRow = columns.map((col) => escapeCell(col.label)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((col) => escapeCell(typeof col.accessor === "function" ? col.accessor(row) : row[col.accessor])).join(",")
  );

  const csvContent = [headerRow, ...dataRows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
