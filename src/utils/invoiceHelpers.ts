/* eslint-disable no-plusplus */
// /* eslint-disable @typescript-eslint/no-unused-vars */
// /* eslint-disable no-unused-vars */
/* eslint-disable camelcase */

interface InvoiceItem {
  description: string;
  price: number;
  qty: number;
  gst: number;
  amount?: number;
}

/**
 * Chunk invoice items into pages (20 items per page)
 */
export const chunkInvoiceItems = (items: InvoiceItem[]): InvoiceItem[][] => {
  const chunks: InvoiceItem[][] = [];
  const itemsPerPage = 20;

  for (let i = 0; i < items.length; i += itemsPerPage) {
    chunks.push(items.slice(i, i + itemsPerPage));
  }

  return chunks;
};

//  * Convert invoice items chunk to template placeholders
export const itemsToPlaceholders = (items: InvoiceItem[]): Record<string, string | number> => {
  const placeholders: Record<string, string | number> = {};
  const maxItems = 20;

  for (let i = 0; i < maxItems; i++) {
    const item = items[i];
    const pos = i + 1;

    if (item) {
      const lineValue = item.price * item.qty;
      const lineAmount = lineValue + item.gst;
      placeholders[`text${pos}`] = item.description;
      placeholders[`uprice${pos}`] = item.price.toFixed(2);
      placeholders[`qty${pos}`] = item.qty;
      placeholders[`tax${pos}`] = item.gst;
      placeholders[`amt${pos}`] = lineAmount.toFixed(2);
    } else {
      placeholders[`text${pos}`] = "";
      placeholders[`uprice${pos}`] = "";
      placeholders[`qty${pos}`] = "";
      placeholders[`tax${pos}`] = "";
      placeholders[`amt${pos}`] = "";
    }
  }

  return placeholders;
};

/**
 * Calculate invoice totals (GST is absolute, NOT percentage)
 */
export const calculateInvoiceTotals = (items: InvoiceItem[]) => {
  const totals = items.reduce(
    (acc, item) => {
      const price = item.price || 0;
      const qty = item.qty || 0;
      const gst = item.gst || 0;

      const lineValue = price * qty;
      const lineAmount = lineValue + gst;

      acc.totalValue += lineValue;
      acc.totalGst += gst;
      acc.amount += lineAmount;

      return acc;
    },
    {
      totalValue: 0,
      totalGst: 0,
      amount: 0
    }
  );

  return {
    total_val: totals.totalValue.toFixed(2),
    total_gst: totals.totalGst.toFixed(2),
    amount: totals.amount.toFixed(2)
  };
};
