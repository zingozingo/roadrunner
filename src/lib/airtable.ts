/**
 * Airtable REST API client — minimal, no npm dependency.
 * Handles pagination (100 records/page) and rate limiting (5 req/sec).
 */

const BASE_ID = "appy9TT1LRJTAuQ4W";
const API_BASE = `https://api.airtable.com/v0/${BASE_ID}`;

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

function getApiKey(): string {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error("AIRTABLE_API_KEY environment variable is required");
  return key;
}

/**
 * Fetch all records from an Airtable table, handling pagination.
 * Uses returnFieldsByFieldId=true so field keys are stable IDs, not names.
 */
export async function fetchAllRecords(tableId: string): Promise<AirtableRecord[]> {
  const apiKey = getApiKey();
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`${API_BASE}/${tableId}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable API error ${res.status}: ${body}`);
    }

    const data: AirtableListResponse = await res.json();
    all.push(...data.records);
    offset = data.offset;

    // Respect rate limit (5 req/sec → 200ms between requests)
    if (offset) await new Promise((r) => setTimeout(r, 200));
  } while (offset);

  return all;
}

/**
 * Fetch a single record by its Airtable record ID.
 */
export async function fetchRecord(
  tableId: string,
  recordId: string
): Promise<AirtableRecord> {
  const apiKey = getApiKey();
  const url = new URL(`${API_BASE}/${tableId}/${recordId}`);
  url.searchParams.set("returnFieldsByFieldId", "true");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable fetch error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Create a new record in an Airtable table. Fields keyed by field ID.
 * Returns the created record (with its new Airtable record ID).
 */
export async function createRecord(
  tableId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/${tableId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable create error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Update an existing Airtable record. Fields keyed by field ID.
 * Only the specified fields are updated (PATCH semantics).
 */
export async function updateRecord(
  tableId: string,
  recordId: string,
  fields: Record<string, unknown>
): Promise<AirtableRecord> {
  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/${tableId}/${recordId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable update error ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Delete a record from an Airtable table by its record ID.
 */
export async function deleteRecord(
  tableId: string,
  recordId: string
): Promise<void> {
  const apiKey = getApiKey();
  const res = await fetch(`${API_BASE}/${tableId}/${recordId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable delete error ${res.status}: ${body}`);
  }
}

/**
 * Fetch all records from a table as a Map keyed by record ID.
 * Useful for resolving linked record references.
 */
export async function fetchRecordMap(
  tableId: string,
  nameFieldId: string
): Promise<Map<string, string>> {
  const records = await fetchAllRecords(tableId);
  const map = new Map<string, string>();
  for (const rec of records) {
    const name = rec.fields[nameFieldId];
    if (typeof name === "string") {
      map.set(rec.id, name);
    }
  }
  return map;
}
