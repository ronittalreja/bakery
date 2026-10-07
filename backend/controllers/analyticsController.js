const db = require('../config/database');

const getOverallAnalytics = async (req, res) => {
  try {
    const { date } = req.query;
    
    const connection = await db.getConnection();
    
    // Get overall stats across all stores
    const [totalStats] = await connection.query(`
      SELECT 
        COALESCE(SUM(si.total_amount), 0) as total_sales,
        COUNT(DISTINCT s.id) as total_orders,
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT st.id) as total_stores
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON 1=1
      LEFT JOIN stores st ON st.status = 'active'
      ${date ? `WHERE DATE(s.sale_date) = ?` : ''}
    `, date ? [date] : []);
    
    // Get store-wise analytics
    const [storeStats] = await connection.query(`
      SELECT 
        s.store_id,
        st.store_name,
        COALESCE(SUM(si.total_amount), 0) as total_sales,
        COUNT(DISTINCT s.id) as total_orders,
        COUNT(DISTINCT p.id) as total_products
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      LEFT JOIN products p ON p.store_id = s.store_id
      LEFT JOIN stores st ON st.id = s.store_id
      ${date ? `WHERE DATE(s.sale_date) = ?` : ''}
      GROUP BY s.store_id, st.store_name
      ORDER BY total_sales DESC
    `, date ? [date] : []);
    
    connection.release();
    
    res.json({
      total_sales: totalStats[0].total_sales || 0,
      total_orders: totalStats[0].total_orders || 0,
      total_products: totalStats[0].total_products || 0,
      total_stores: totalStats[0].total_stores || 0,
      store_analytics: storeStats
    });
  } catch (error) {
    console.error('Error fetching overall analytics:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getOverallAnalytics
};
