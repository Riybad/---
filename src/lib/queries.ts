import { db, type Custody, type Invoice, type Transaction } from "./db";

export function getTotals() {
  const row = db()
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'revenue' THEN amount END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
      FROM transactions`
    )
    .get() as { revenue: number; expense: number };
  return row;
}

export function getCustodyStats() {
  const rows = db()
    .prepare(
      `SELECT status, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS amount
       FROM custodies GROUP BY status`
    )
    .all() as { status: string; count: number; amount: number }[];
  const stat = (s: string) => rows.find((r) => r.status === s) ?? { count: 0, amount: 0 };
  return {
    pending: stat("pending"),
    open: stat("open"),
    pendingClose: stat("pending_close"),
    closed: stat("closed"),
  };
}

export function listTransactions(limit?: number): Transaction[] {
  const sql = `SELECT * FROM transactions ORDER BY date DESC, id DESC ${limit ? "LIMIT ?" : ""}`;
  return (limit ? db().prepare(sql).all(limit) : db().prepare(sql).all()) as Transaction[];
}

export function listCustodies(status?: string, limit?: number): Custody[] {
  let sql = "SELECT * FROM custodies";
  const params: (string | number)[] = [];
  if (status) {
    sql += " WHERE status = ?";
    params.push(status);
  }
  sql += " ORDER BY id DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(limit);
  }
  return db().prepare(sql).all(...params) as Custody[];
}

export function getCustody(id: number): Custody | undefined {
  return db().prepare("SELECT * FROM custodies WHERE id = ?").get(id) as Custody | undefined;
}

export function getCustodyByCloseToken(token: string): Custody | undefined {
  return db().prepare("SELECT * FROM custodies WHERE close_token = ?").get(token) as
    | Custody
    | undefined;
}

export function listInvoices(custodyId: number): Invoice[] {
  return db()
    .prepare("SELECT * FROM invoices WHERE custody_id = ? ORDER BY id")
    .all(custodyId) as Invoice[];
}

export function getInvoice(id: number): Invoice | undefined {
  return db().prepare("SELECT * FROM invoices WHERE id = ?").get(id) as Invoice | undefined;
}
