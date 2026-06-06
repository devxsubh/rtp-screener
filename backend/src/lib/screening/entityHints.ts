import type { ColumnMapping, EntityScreeningQuery } from "../../types/screening";
import { extractCsvTable } from "./parseCapTable";

function cell(row: string[], headers: string[], column?: string): string {
  if (!column) return "";
  const idx = headers.indexOf(column);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

function mergeHint(
  map: Map<string, EntityScreeningQuery>,
  name: string,
  partial: EntityScreeningQuery,
): void {
  const key = name.trim();
  if (!key) return;
  const existing = map.get(key) ?? {};
  const altNames = new Set(existing.altNames ?? []);
  for (const alt of partial.altNames ?? []) {
    if (alt && alt !== key) altNames.add(alt);
  }
  map.set(key, {
    altNames: altNames.size > 0 ? [...altNames] : existing.altNames,
    birthDate: partial.birthDate || existing.birthDate,
    address: partial.address || existing.address,
    country: partial.country || existing.country,
    registrationId: partial.registrationId || existing.registrationId,
  });
}

/** Build optional Watchman query hints keyed by entity name from CSV columns. */
export function buildEntityHintsMap(
  csv: string,
  mapping: ColumnMapping | null,
): Map<string, EntityScreeningQuery> {
  const hints = new Map<string, EntityScreeningQuery>();
  if (!mapping) return hints;

  const hasHintColumns =
    mapping.alt_name ||
    mapping.birth_date ||
    mapping.address ||
    mapping.country ||
    mapping.registration_id;
  if (!hasHintColumns) return hints;

  const table = extractCsvTable(csv);
  if (!table) return hints;

  const nameColumns: string[] = [];
  if (mapping.name) nameColumns.push(mapping.name);
  if (mapping.entity) nameColumns.push(mapping.entity);
  if (mapping.owner) nameColumns.push(mapping.owner);
  if (nameColumns.length === 0) return hints;

  for (const row of table.rows) {
    const partial: EntityScreeningQuery = {};
    const alt = cell(row, table.headers, mapping.alt_name);
    if (alt) partial.altNames = [alt];
    const birthDate = cell(row, table.headers, mapping.birth_date);
    if (birthDate) partial.birthDate = birthDate;
    const address = cell(row, table.headers, mapping.address);
    if (address) partial.address = address;
    const country = cell(row, table.headers, mapping.country);
    if (country) partial.country = country;
    const registrationId = cell(row, table.headers, mapping.registration_id);
    if (registrationId) partial.registrationId = registrationId;

    if (
      !partial.altNames &&
      !partial.birthDate &&
      !partial.address &&
      !partial.country &&
      !partial.registrationId
    ) {
      continue;
    }

    for (const col of nameColumns) {
      const name = cell(row, table.headers, col);
      if (name) mergeHint(hints, name, partial);
    }
  }

  return hints;
}
