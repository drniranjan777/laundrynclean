/**
 * Thermal Receipt Print Component
 * Supports 58mm (2 inch) and 80mm (3 inch) paper
 * Use with window.print() — only this component shows when printing
 */
export default function InvoicePrint({ order, gstSettings }) {
  if (!order) return null;

  const booking = order.booking || order;
  const items = booking.items || [];
  const barcodes = order.barcodes || items.map(i => ({ name: i.name, barcode: i.barcode, garmentColor: i.garmentColor }));

  return (
    <div className="print-only hidden print:block">
      {/* Receipt */}
      <div className="receipt-container" style={{ width: '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '12px', padding: '5mm' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '8px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0' }}>{gstSettings?.businessName || 'NClean'}</h1>
          <p style={{ margin: '2px 0', fontSize: '10px' }}>{gstSettings?.businessAddress || ''}</p>
          <p style={{ margin: '2px 0', fontSize: '10px' }}>Ph: {gstSettings?.businessPhone || ''}</p>
          {gstSettings?.gstin && <p style={{ margin: '2px 0', fontSize: '10px' }}>GSTIN: {gstSettings.gstin}</p>}
        </div>

        {/* Invoice Info */}
        <div style={{ marginBottom: '8px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Invoice: {booking.invoiceNumber}</span>
            <span>{new Date(booking.createdAt || Date.now()).toLocaleDateString()}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Order: {booking.orderNumber}</span>
            <span>{booking.orderType === 'offline' ? 'COUNTER' : 'ONLINE'}</span>
          </div>
        </div>

        {/* Customer */}
        <div style={{ marginBottom: '8px', borderBottom: '1px dashed #000', paddingBottom: '6px', fontSize: '11px' }}>
          <p style={{ margin: '2px 0' }}>Customer: {booking.customerName || '—'}</p>
          <p style={{ margin: '2px 0' }}>Phone: {booking.customerPhone || '—'}</p>
          {booking.estimatedDeliveryDate && <p style={{ margin: '2px 0' }}>Delivery: {booking.estimatedDeliveryDate}</p>}
        </div>

        {/* Items */}
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '2px 0' }}>Item</th>
              <th style={{ textAlign: 'center', padding: '2px' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '2px 0' }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td style={{ padding: '2px 0', maxWidth: '40mm', overflow: 'hidden' }}>
                  {item.name}
                  {item.garmentColor && <span style={{ fontSize: '9px' }}> ({item.garmentColor})</span>}
                </td>
                <td style={{ textAlign: 'center', padding: '2px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '2px 0' }}>₹{parseFloat(item.lineTotal || item.line_total || 0).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span><span>₹{parseFloat(booking.subtotal || 0).toFixed(0)}</span>
          </div>
          {parseFloat(booking.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Discount:</span><span>-₹{parseFloat(booking.discount).toFixed(0)}</span>
            </div>
          )}
          {parseFloat(booking.gstAmount || booking.gst_amount || 0) > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>CGST ({parseFloat(booking.gstRate || booking.gst_rate || 0) / 2}%):</span><span>₹{parseFloat(booking.cgst || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span>SGST ({parseFloat(booking.gstRate || booking.gst_rate || 0) / 2}%):</span><span>₹{parseFloat(booking.sgst || 0).toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '1px solid #000', marginTop: '4px', paddingTop: '4px' }}>
            <span>TOTAL:</span><span>₹{parseFloat(booking.total || 0).toFixed(0)}</span>
          </div>
        </div>

        {/* Payment */}
        <div style={{ marginTop: '8px', fontSize: '10px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
          <p style={{ margin: '2px 0' }}>Payment: {booking.paymentMethodDetail || booking.payment_method_detail || booking.paymentMethod || 'Cash'}</p>
          <p style={{ margin: '2px 0' }}>Status: {booking.paymentStatus === 'paid' || booking.payment_status === 'paid' ? 'PAID' : 'PENDING'}</p>
          {gstSettings?.hsnCode && <p style={{ margin: '2px 0' }}>HSN: {gstSettings.hsnCode}</p>}
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '12px', borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '10px' }}>
          <p style={{ margin: '2px 0' }}>Thank you for choosing NClean!</p>
          <p style={{ margin: '2px 0' }}>Premium Ironing, Delivered to Your Door</p>
        </div>
      </div>

      {/* Barcode Labels - separate page */}
      {barcodes.length > 0 && (
        <div style={{ pageBreakBefore: 'always', padding: '5mm' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5mm' }}>
            {barcodes.map((b, i) => (
              <div key={i} style={{ border: '1px solid #000', padding: '3mm', width: '50mm', textAlign: 'center', fontFamily: 'monospace' }}>
                <p style={{ fontSize: '9px', margin: '0 0 2px', fontWeight: 'bold' }}>{booking.customerName}</p>
                <p style={{ fontSize: '8px', margin: '0 0 4px' }}>{b.name} {b.garmentColor ? `(${b.garmentColor})` : ''}</p>
                {/* Barcode representation using CSS */}
                <div style={{ fontSize: '20px', letterSpacing: '2px', fontWeight: 'bold', margin: '4px 0' }}>
                  ||||| {b.barcode} |||||
                </div>
                <p style={{ fontSize: '8px', margin: '2px 0', fontFamily: 'monospace' }}>{b.barcode}</p>
                <p style={{ fontSize: '7px', margin: '2px 0', color: '#666' }}>{booking.orderNumber} | {new Date().toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
