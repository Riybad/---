import { q, type Custody, type Invoice, type Transaction } from "./db";

export async function getTotals(): Promise<{ revenue: number; expense: number }> {
  const rows = await q(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount END), 0)::float8 AS revenue,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0)::float8 AS expense
    FROM transactions`
  );
  return rows[0] as { revenue: number; expense: number };
}

export async function getCustodyStats() {
  const rows = (await q(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS amount
     FROM custodies GROUP BY status`
  )) as { status: string; count: number; amount: number }[];
  const stat = (s: string) => rows.find((r) => r.status === s) ?? { count: 0, amount: 0 };
  return {
    pending: stat("pending"),
    open: stat("open"),
    pendingClose: stat("pending_close"),
    closed: stat("closed"),
  };
}

export async function listTransactions(limit?: number): Promise<Transaction[]> {
  if (limit) {
    return (await q("SELECT * FROM transactions ORDER BY date DESC, id DESC LIMIT $1", [
      limit,
    ])) as Transaction[];
  }
  return (await q("SELECT * FROM transactions ORDER BY date DESC, id DESC")) as Transaction[];
}

export async function listCustodies(status?: string, limit?: number): Promise<Custody[]> {
  let sql = "SELECT * FROM custodies";
  const params: (string | number)[] = [];
  if (status) {
    params.push(status);
    sql += ` WHERE status = $${params.length}`;
  }
  sql += " ORDER BY id DESC";
  if (limit) {
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
  }
  return (await q(sql, params)) as Custody[];
}

export async function getCustody(id: number): Promise<Custody | undefined> {
  const rows = await q("SELECT * FROM custodies WHERE id = $1", [id]);
  return rows[0] as Custody | undefined;
}

export async function getCustodyByCloseToken(token: string): Promise<Custody | undefined> {
  const rows = await q("SELECT * FROM custodies WHERE close_token = $1", [token]);
  return rows[0] as Custody | undefined;
}

export async function listInvoices(custodyId: number): Promise<Invoice[]> {
  return (await q("SELECT * FROM invoices WHERE custody_id = $1 ORDER BY id", [
    custodyId,
  ])) as Invoice[];
}

export async function getInvoice(id: number): Promise<Invoice | undefined> {
  const rows = await q("SELECT * FROM invoices WHERE id = $1", [id]);
  return rows[0] as Invoice | undefined;
}
