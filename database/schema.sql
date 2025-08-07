-- Table1837 Tavern Database Schema
-- Enterprise-grade PostgreSQL schema for Supabase

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Users table with role-based access control
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('boss', 'manager', 'staff')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Menu items table - central repository for all menu data
CREATE TABLE menu_items (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'wine_list', 'featured_menu', 'signature_cocktails', 'tavern_menu'
    )),
    subcategory VARCHAR(100),
    available BOOLEAN DEFAULT true,
    tags TEXT[] DEFAULT '{}',
    image_url TEXT,
    allergens TEXT[],
    nutritional_info JSONB,
    preparation_time INTEGER, -- minutes
    spice_level INTEGER CHECK (spice_level >= 0 AND spice_level <= 5),
    alcohol_content DECIMAL(4,2), -- percentage
    vintage INTEGER, -- for wines
    region VARCHAR(255), -- for wines
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Menu updates audit log
CREATE TABLE menu_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    menu_type VARCHAR(50) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('create', 'update', 'delete', 'bulk_update')),
    changes JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);
CREATE INDEX idx_menu_items_tags ON menu_items USING GIN(tags);
CREATE INDEX idx_menu_items_search ON menu_items USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_menu_items_price ON menu_items(price) WHERE price IS NOT NULL;
CREATE INDEX idx_menu_items_updated ON menu_items(updated_at DESC);

CREATE INDEX idx_menu_updates_user_id ON menu_updates(user_id);
CREATE INDEX idx_menu_updates_created_at ON menu_updates(created_at DESC);
CREATE INDEX idx_menu_updates_menu_type ON menu_updates(menu_type);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);

-- Full-text search index for menu items
CREATE INDEX idx_menu_items_fts ON menu_items USING GIN(
    to_tsvector('english', 
        name || ' ' || 
        COALESCE(description, '') || ' ' || 
        COALESCE(subcategory, '') || ' ' ||
        array_to_string(tags, ' ')
    )
);

-- Update triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_menu_items_updated_at 
    BEFORE UPDATE ON menu_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_updates ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Boss can view all users" ON users
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'boss'
        )
    );

-- Menu items policies - public read, authenticated write based on role
CREATE POLICY "Anyone can view available menu items" ON menu_items
    FOR SELECT USING (available = true);

CREATE POLICY "Admin can view all menu items" ON menu_items
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('boss', 'manager')
        )
    );

CREATE POLICY "Boss and managers can insert menu items" ON menu_items
    FOR INSERT WITH CHECK (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('boss', 'manager') AND active = true
        )
    );

CREATE POLICY "Boss and managers can update menu items" ON menu_items
    FOR UPDATE USING (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('boss', 'manager') AND active = true
        )
    );

CREATE POLICY "Only boss can delete menu items" ON menu_items
    FOR DELETE USING (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'boss' AND active = true
        )
    );

-- Menu updates policies
CREATE POLICY "Admin can view menu updates" ON menu_updates
    FOR SELECT USING (
        EXISTS(
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role IN ('boss', 'manager')
        )
    );

CREATE POLICY "System can insert menu updates" ON menu_updates
    FOR INSERT WITH CHECK (true);

-- Useful views for performance
CREATE VIEW active_menu_summary AS
SELECT 
    category,
    COUNT(*) as item_count,
    AVG(price) as avg_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    COUNT(*) FILTER (WHERE tags && ARRAY['featured']) as featured_count,
    MAX(updated_at) as last_updated
FROM menu_items 
WHERE available = true 
GROUP BY category;

CREATE VIEW recent_menu_activity AS
SELECT 
    mu.*,
    u.name as user_name,
    u.role as user_role
FROM menu_updates mu
JOIN users u ON mu.user_id = u.id
WHERE mu.created_at >= NOW() - INTERVAL '7 days'
ORDER BY mu.created_at DESC;

-- Sample data for testing (remove in production)
INSERT INTO users (id, email, name, role) VALUES 
('00000000-0000-0000-0000-000000000001', 'boss@table1837.com', 'Master Boss', 'boss'),
('00000000-0000-0000-0000-000000000002', 'manager@table1837.com', 'Head Manager', 'manager'),
('00000000-0000-0000-0000-000000000003', 'staff@table1837.com', 'Senior Staff', 'staff');

-- Sample menu items
INSERT INTO menu_items (id, name, description, price, category, tags) VALUES 
('wine_sample_001', 'Caymus Cabernet Sauvignon', 'Rich, full-bodied Napa Valley Cabernet with notes of dark fruit and vanilla', 18.00, 'wine_list', '{"featured", "red", "napa"}'),
('cocktail_sample_001', 'Table 1837 Old Fashioned', 'Our signature old fashioned with bourbon, house-made simple syrup, and orange bitters', 14.00, 'signature_cocktails', '{"signature", "bourbon", "featured"}'),
('featured_sample_001', 'Pan-Seared Salmon', 'Atlantic salmon with lemon herb butter, seasonal vegetables, and wild rice', 28.00, 'featured_menu', '{"featured", "seafood", "healthy"}'),
('tavern_sample_001', 'Tavern Burger', 'House-ground beef patty with aged cheddar, bacon, and tavern sauce on brioche bun', 16.00, 'tavern_menu', '{"burger", "popular"}')
;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Refresh materialized views (if any created later)
-- Add monitoring and alerting functions as needed

-- Performance monitoring function
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
    table_name text,
    row_count bigint,
    total_size text,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname||'.'||tablename as table_name,
        n_tup_ins + n_tup_upd as row_count,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
