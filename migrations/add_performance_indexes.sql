-- Performance optimization indexes
-- These indexes will significantly improve query performance for frequently accessed columns

-- Indexes for processing_charges table
CREATE INDEX IF NOT EXISTS idx_processing_charges_cash_processing_id ON processing_charges(cash_processing_id);
CREATE INDEX IF NOT EXISTS idx_processing_charges_created_at ON processing_charges(created_at DESC);

-- Indexes for cash_processing table
CREATE INDEX IF NOT EXISTS idx_cash_processing_request_id ON cash_processing(request_id);
CREATE INDEX IF NOT EXISTS idx_cash_processing_created_at ON cash_processing(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_processing_cash_count_id ON cash_processing(cash_count_id);

-- Indexes for requests table
CREATE INDEX IF NOT EXISTS idx_requests_branch_id ON requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_requests_service_type_id ON requests(service_type_id);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_my_status ON requests(my_status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_pickup_date ON requests(pickup_date);

-- Indexes for clients table
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Indexes for branches table
CREATE INDEX IF NOT EXISTS idx_branches_client_id ON branches(client_id);

-- Indexes for staff table
CREATE INDEX IF NOT EXISTS idx_staff_branch_id ON staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_role_id ON staff(role_id);
CREATE INDEX IF NOT EXISTS idx_staff_created_at ON staff(created_at DESC);

-- Indexes for cash_counts table
CREATE INDEX IF NOT EXISTS idx_cash_counts_request_id ON cash_counts(request_id);
CREATE INDEX IF NOT EXISTS idx_cash_counts_status ON cash_counts(status);
CREATE INDEX IF NOT EXISTS idx_cash_counts_created_at ON cash_counts(created_at DESC);

-- Indexes for client_update table (ATM loading)
CREATE INDEX IF NOT EXISTS idx_client_update_client_id ON client_update(client_id);
CREATE INDEX IF NOT EXISTS idx_client_update_atm_id ON client_update(atm_id);
CREATE INDEX IF NOT EXISTS idx_client_update_loading_date ON client_update(loading_date);
CREATE INDEX IF NOT EXISTS idx_client_update_created_at ON client_update(created_at DESC);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_requests_branch_status ON requests(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_processing_charges_created_amount ON processing_charges(created_at DESC, processing_fee_amount);

