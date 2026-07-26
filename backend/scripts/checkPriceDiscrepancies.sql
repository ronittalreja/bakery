-- SQL Query to identify products with price discrepancies
-- This compares the latest invoice rate for each item with the current product invoice_price

-- Find products where the latest invoice rate differs from the current invoice_price
SELECT 
    p.id as product_id,
    p.item_code,
    p.name as product_name,
    p.invoice_price as current_invoice_price,
    p.sale_price as current_sale_price,
    p.updated_at as product_last_updated,
    latest_invoice.latest_invoice_rate,
    latest_invoice.latest_invoice_date,
    latest_invoice.latest_invoice_number,
    latest_invoice.rate_difference,
    latest_invoice.percentage_difference
FROM products p
LEFT JOIN (
    -- Get the latest invoice rate for each product based on item_code
    SELECT 
        ii.item_code,
        ii.item_name,
        ii.rate as latest_invoice_rate,
        i.invoice_date as latest_invoice_date,
        i.invoice_number as latest_invoice_number,
        ii.rate - p.invoice_price as rate_difference,
        CASE 
            WHEN p.invoice_price = 0 THEN 0
            ELSE ((ii.rate - p.invoice_price) / p.invoice_price) * 100 
        END as percentage_difference,
        ROW_NUMBER() OVER (PARTITION BY ii.item_code ORDER BY i.invoice_date DESC, i.id DESC) as rn
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    JOIN products p ON ii.item_code = p.item_code
) latest_invoice ON p.item_code = latest_invoice.item_code AND latest_invoice.rn = 1
WHERE latest_invoice.rate_difference != 0
   OR latest_invoice.rate_difference IS NULL
ORDER BY ABS(latest_invoice.percentage_difference) DESC;

-- Alternative: Find products that haven't been updated recently despite having recent invoices
SELECT 
    p.id as product_id,
    p.item_code,
    p.name as product_name,
    p.invoice_price as current_invoice_price,
    p.sale_price as current_sale_price,
    p.updated_at as product_last_updated,
    latest_invoice.latest_invoice_date,
    latest_invoice.latest_invoice_number,
    DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) as days_since_price_update
FROM products p
JOIN (
    -- Get the latest invoice date for each product
    SELECT 
        ii.item_code,
        MAX(i.invoice_date) as latest_invoice_date,
        MAX(i.invoice_number) as latest_invoice_number
    FROM invoice_items ii
    JOIN invoices i ON ii.invoice_id = i.id
    GROUP BY ii.item_code
) latest_invoice ON p.item_code = latest_invoice.item_code
WHERE DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) > 0
ORDER BY DATEDIFF(latest_invoice.latest_invoice_date, p.updated_at) DESC;
