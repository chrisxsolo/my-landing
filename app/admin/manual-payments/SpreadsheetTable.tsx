"use client";
// Spreadsheet grid: a live mirror of the payments table. Deposit 1 /
// Deposit 2 / Full columns arrive pre-populated — saved payments verbatim
// (locked, ✓), everything else as editable schedule suggestions.

import { REV } from "@/app/admin/payments/palette";
import { displayMoney, METHODS, PAYMENT_TYPES } from "./helpers";
import RowActions from "./RowActions";
import type { InquiryOption, PaymentRow, SavedPayment } from "./types";

export type AmountCol = "d1" | "d2" | "full";

const TH = "sticky top-0 z-10 px-2 py-2.5 text-left text-[9px] font-black uppercase tracking-[0.14em] whitespace-nowrap";
const INPUT = "h-9 w-full min-w-0 rounded-lg border-0 bg-transparent px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-emerald-500/50";

const COL_TO_TYPE: Record<AmountCol, string> = { d1: "deposit_1", d2: "deposit_2", full: "full" };

type Props = {
  rows: PaymentRow[];
  inquiries: InquiryOption[];
  payments: SavedPayment[];
  selectedKeys: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleRow: (key: string, checked: boolean) => void;
  onPatch: (key: string, patch: Partial<PaymentRow>, touch?: boolean) => void;
  onEditAmount: (key: string, col: AmountCol, value: string) => void;
  onApplyInquiry: (key: string, value: string) => void;
  onDeleteRow: (row: PaymentRow) => void;
  onSaved: (saved: SavedPayment[], message: string) => void;
  onError: (message: string) => void;
  onVoided: (inquiryId: number) => void;
};

function rowTint(row: PaymentRow): string {
  if (!row.inquiry_id) return "transparent";
  if (row.d1Paid && row.d2Paid) return "rgba(16,185,129,0.07)";
  if (row.d1Paid) return "rgba(217,144,12,0.06)";
  return "transparent";
}

function AmountCell({ row, col, onEdit }: {
  row: PaymentRow; col: AmountCol; onEdit: (value: string) => void;
}) {
  const value = row[col];
  const paid = col === "d1" ? row.d1Paid : col === "d2" ? row.d2Paid : row.d1Paid && row.d2Paid;
  const isActiveType = row.payment_type === COL_TO_TYPE[col];

  if (paid) {
    return (
      <div className="flex h-9 items-center gap-1.5 px-2" title={`Recorded in the database (${row.totalSource})`}>
        <span aria-hidden className="text-[10px] font-black" style={{ color: REV.accent }}>✓</span>
        <span className="text-xs font-black tabular-nums" style={{ color: REV.accent }}>
          {value ? displayMoney(value) : "—"}
        </span>
      </div>
    );
  }
  return (
    <div className="relative flex h-9 items-center rounded-lg"
      style={isActiveType ? { boxShadow: `inset 0 0 0 1.5px ${REV.accentBg}`, background: "rgba(16,185,129,0.05)" } : undefined}
      title={isActiveType ? "This amount saves with the selected type" : row.totalSource !== "manual" ? `Suggested from ${row.totalSource} — edit freely` : undefined}>
      <span className="pl-2 text-xs font-bold" style={{ color: REV.textFaint }}>$</span>
      <input className={`${INPUT} pl-0.5 tabular-nums`} inputMode="decimal" value={value}
        style={{ color: REV.text }}
        aria-label={`${COL_TO_TYPE[col].replace("_", " ")} amount for ${row.client_name || "new client"}`}
        onChange={e => onEdit(e.target.value)} />
    </div>
  );
}

export default function SpreadsheetTable({
  rows, inquiries, payments, selectedKeys, allSelected,
  onToggleAll, onToggleRow, onPatch, onEditAmount, onApplyInquiry, onDeleteRow,
  onSaved, onError, onVoided,
}: Props) {
  const select = (value: string, onChange: (v: string) => void, options: { value: string; label: string }[], label: string) => (
    <select className={INPUT} value={value} aria-label={label} style={{ color: REV.textSoft }}
      onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1360px] border-collapse">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.92)", color: REV.textFaint, boxShadow: `inset 0 -1px 0 ${REV.panelBorderStrong}` }}>
            <th className={`${TH} w-[44px] text-center`}>
              <input type="checkbox" checked={allSelected} onChange={onToggleAll} className="cursor-pointer accent-emerald-600" aria-label="Select all rows" />
            </th>
            <th className={`${TH} w-[40px]`}>#</th>
            <th className={`${TH} w-[180px]`}>Client</th>
            <th className={`${TH} w-[200px]`}>Email</th>
            <th className={`${TH} w-[110px]`}>Deposit 1</th>
            <th className={`${TH} w-[110px]`}>Deposit 2</th>
            <th className={`${TH} w-[110px]`}>Full total</th>
            <th className={`${TH} w-[110px]`}>Method</th>
            <th className={`${TH} w-[105px]`}>Type</th>
            <th className={`${TH} w-[125px]`}>Paid date</th>
            <th className={`${TH} w-[125px]`}>Session date</th>
            <th className={`${TH} w-[185px]`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className="group transition-colors"
              style={{ background: rowTint(row), boxShadow: `inset 0 -1px 0 ${REV.rowBorder}` }}>
              <td className="px-2 text-center">
                <div className="flex items-center justify-center gap-1">
                  <input type="checkbox" checked={selectedKeys.has(row.key)} className="cursor-pointer accent-emerald-600"
                    aria-label={`Select ${row.client_name || `row ${index + 1}`}`}
                    onChange={e => onToggleRow(row.key, e.target.checked)} />
                  <button onClick={() => onDeleteRow(row)} title="Remove row"
                    className="text-sm font-black opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                    style={{ color: REV.red }}>×</button>
                </div>
              </td>
              <td className="px-2 text-center text-[10px] font-black tabular-nums" style={{ color: REV.textFaint }}>
                {row.touched ? <span title="Edited — will be included in Save" style={{ color: REV.amber }}>●</span> : index + 1}
              </td>
              <td>
                <input list="manual-payment-clients" className={INPUT} value={row.client_name}
                  style={{ color: REV.text }} aria-label="Client name"
                  onChange={e => onApplyInquiry(row.key, e.target.value)} />
              </td>
              <td>
                <input className={INPUT} type="email" value={row.client_email} aria-label="Client email"
                  style={{ color: REV.textSoft }}
                  onChange={e => onPatch(row.key, { client_email: e.target.value, inquiry_id: null }, true)} />
              </td>
              <td><AmountCell row={row} col="d1" onEdit={v => onEditAmount(row.key, "d1", v)} /></td>
              <td><AmountCell row={row} col="d2" onEdit={v => onEditAmount(row.key, "d2", v)} /></td>
              <td><AmountCell row={row} col="full" onEdit={v => onEditAmount(row.key, "full", v)} /></td>
              <td>{select(row.method, v => onPatch(row.key, { method: v }, true), METHODS.map(m => ({ value: m, label: m })), "Payment method")}</td>
              <td>{select(row.payment_type, v => onPatch(row.key, { payment_type: v }, true), PAYMENT_TYPES, "Payment type")}</td>
              <td>
                <input className={INPUT} type="date" value={row.paid_at} aria-label="Paid date"
                  style={{ color: REV.textSoft }}
                  onChange={e => onPatch(row.key, { paid_at: e.target.value }, true)} />
              </td>
              <td>
                <input className={INPUT} type="date" value={row.session_date} aria-label="Session date"
                  style={{ color: REV.textSoft }}
                  onChange={e => onPatch(row.key, { session_date: e.target.value }, true)} />
              </td>
              <td>
                <RowActions row={row} payments={payments} onSaved={onSaved} onError={onError} onVoided={onVoided} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <datalist id="manual-payment-clients">
        {inquiries.map(i => <option key={i.id} value={i.name}>{i.email}</option>)}
      </datalist>
    </div>
  );
}
