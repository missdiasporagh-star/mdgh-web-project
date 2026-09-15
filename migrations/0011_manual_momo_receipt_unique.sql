CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_momo_receipt
ON applications(payaza_transaction_id)
WHERE payment_status = 'paid' AND payaza_transaction_id LIKE 'MOMO:%';
