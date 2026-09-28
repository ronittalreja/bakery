// Populate Tomorrow AI Events Calendar
// Populates Indian festivals and special days for 2024-2026

const db = require('../config/database');

async function populateEvents() {
  try {
    console.log('Starting event calendar population...');

    const events = [
      // 2024 Events
      { event_name: 'New Year', event_type: 'HOLIDAY', event_date: '2024-01-01', year: 2024, description: 'New Year Day' },
      { event_name: 'Republic Day', event_type: 'HOLIDAY', event_date: '2024-01-26', year: 2024, description: 'Republic Day of India' },
      { event_name: 'Valentine Day', event_type: 'SPECIAL_DAY', event_date: '2024-02-14', year: 2024, description: 'Valentine Day' },
      { event_name: 'Holi', event_type: 'FESTIVAL', event_date: '2024-03-25', year: 2024, description: 'Holi Festival of Colors' },
      { event_name: 'Good Friday', event_type: 'HOLIDAY', event_date: '2024-03-29', year: 2024, description: 'Good Friday' },
      { event_name: 'Easter Sunday', event_type: 'SPECIAL_DAY', event_date: '2024-03-31', year: 2024, description: 'Easter Sunday' },
      { event_name: 'Eid ul-Fitr', event_type: 'FESTIVAL', event_date: '2024-04-11', year: 2024, description: 'Eid ul-Fitr' },
      { event_name: 'Mother Day', event_type: 'SPECIAL_DAY', event_date: '2024-05-12', year: 2024, description: 'Mother Day' },
      { event_name: 'Buddha Purnima', event_type: 'FESTIVAL', event_date: '2024-05-23', year: 2024, description: 'Buddha Purnima' },
      { event_name: 'Father Day', event_type: 'SPECIAL_DAY', event_date: '2024-06-16', year: 2024, description: 'Father Day' },
      { event_name: 'Eid al-Adha', event_type: 'FESTIVAL', event_date: '2024-06-17', year: 2024, description: 'Eid al-Adha' },
      { event_name: 'Independence Day', event_type: 'HOLIDAY', event_date: '2024-08-15', year: 2024, description: 'Independence Day of India' },
      { event_name: 'Raksha Bandhan', event_type: 'FESTIVAL', event_date: '2024-08-19', year: 2024, description: 'Raksha Bandhan' },
      { event_name: 'Janmashtami', event_type: 'FESTIVAL', event_date: '2024-08-26', year: 2024, description: 'Janmashtami' },
      { event_name: 'Ganesh Chaturthi', event_type: 'FESTIVAL', event_date: '2024-09-07', year: 2024, description: 'Ganesh Chaturthi' },
      { event_name: 'Onam', event_type: 'FESTIVAL', event_date: '2024-09-15', year: 2024, description: 'Onam Festival' },
      { event_name: 'Gandhi Jayanti', event_type: 'HOLIDAY', event_date: '2024-10-02', year: 2024, description: 'Gandhi Jayanti' },
      { event_name: 'Dussehra', event_type: 'FESTIVAL', event_date: '2024-10-12', year: 2024, description: 'Dussehra' },
      { event_name: 'Diwali', event_type: 'FESTIVAL', event_date: '2024-10-31', year: 2024, description: 'Diwali Festival of Lights' },
      { event_name: 'Govardhan Puja', event_type: 'FESTIVAL', event_date: '2024-11-02', year: 2024, description: 'Govardhan Puja' },
      { event_name: 'Bhai Dooj', event_type: 'FESTIVAL', event_date: '2024-11-03', year: 2024, description: 'Bhai Dooj' },
      { event_name: 'Christmas', event_type: 'HOLIDAY', event_date: '2024-12-25', year: 2024, description: 'Christmas Day' },

      // 2025 Events
      { event_name: 'New Year', event_type: 'HOLIDAY', event_date: '2025-01-01', year: 2025, description: 'New Year Day' },
      { event_name: 'Republic Day', event_type: 'HOLIDAY', event_date: '2025-01-26', year: 2025, description: 'Republic Day of India' },
      { event_name: 'Valentine Day', event_type: 'SPECIAL_DAY', event_date: '2025-02-14', year: 2025, description: 'Valentine Day' },
      { event_name: 'Holi', event_type: 'FESTIVAL', event_date: '2025-03-14', year: 2025, description: 'Holi Festival of Colors' },
      { event_name: 'Good Friday', event_type: 'HOLIDAY', event_date: '2025-04-18', year: 2025, description: 'Good Friday' },
      { event_name: 'Easter Sunday', event_type: 'SPECIAL_DAY', event_date: '2025-04-20', year: 2025, description: 'Easter Sunday' },
      { event_name: 'Eid ul-Fitr', event_type: 'FESTIVAL', event_date: '2025-03-30', year: 2025, description: 'Eid ul-Fitr' },
      { event_name: 'Mother Day', event_type: 'SPECIAL_DAY', event_date: '2025-05-11', year: 2025, description: 'Mother Day' },
      { event_name: 'Buddha Purnima', event_type: 'FESTIVAL', event_date: '2025-05-12', year: 2025, description: 'Buddha Purnima' },
      { event_name: 'Father Day', event_type: 'SPECIAL_DAY', event_date: '2025-06-15', year: 2025, description: 'Father Day' },
      { event_name: 'Eid al-Adha', event_type: 'FESTIVAL', event_date: '2025-06-06', year: 2025, description: 'Eid al-Adha' },
      { event_name: 'Independence Day', event_type: 'HOLIDAY', event_date: '2025-08-15', year: 2025, description: 'Independence Day of India' },
      { event_name: 'Raksha Bandhan', event_type: 'FESTIVAL', event_date: '2025-08-09', year: 2025, description: 'Raksha Bandhan' },
      { event_name: 'Janmashtami', event_type: 'FESTIVAL', event_date: '2025-08-16', year: 2025, description: 'Janmashtami' },
      { event_name: 'Ganesh Chaturthi', event_type: 'FESTIVAL', event_date: '2025-08-27', year: 2025, description: 'Ganesh Chaturthi' },
      { event_name: 'Onam', event_type: 'FESTIVAL', event_date: '2025-09-05', year: 2025, description: 'Onam Festival' },
      { event_name: 'Gandhi Jayanti', event_type: 'HOLIDAY', event_date: '2025-10-02', year: 2025, description: 'Gandhi Jayanti' },
      { event_name: 'Dussehra', event_type: 'FESTIVAL', event_date: '2025-10-02', year: 2025, description: 'Dussehra' },
      { event_name: 'Diwali', event_type: 'FESTIVAL', event_date: '2025-10-20', year: 2025, description: 'Diwali Festival of Lights' },
      { event_name: 'Govardhan Puja', event_type: 'FESTIVAL', event_date: '2025-10-21', year: 2025, description: 'Govardhan Puja' },
      { event_name: 'Bhai Dooj', event_type: 'FESTIVAL', event_date: '2025-10-22', year: 2025, description: 'Bhai Dooj' },
      { event_name: 'Christmas', event_type: 'HOLIDAY', event_date: '2025-12-25', year: 2025, description: 'Christmas Day' },

      // 2026 Events
      { event_name: 'New Year', event_type: 'HOLIDAY', event_date: '2026-01-01', year: 2026, description: 'New Year Day' },
      { event_name: 'Republic Day', event_type: 'HOLIDAY', event_date: '2026-01-26', year: 2026, description: 'Republic Day of India' },
      { event_name: 'Valentine Day', event_type: 'SPECIAL_DAY', event_date: '2026-02-14', year: 2026, description: 'Valentine Day' },
      { event_name: 'Holi', event_type: 'FESTIVAL', event_date: '2026-03-04', year: 2026, description: 'Holi Festival of Colors' },
      { event_name: 'Good Friday', event_type: 'HOLIDAY', event_date: '2026-04-03', year: 2026, description: 'Good Friday' },
      { event_name: 'Easter Sunday', event_type: 'SPECIAL_DAY', event_date: '2026-04-05', year: 2026, description: 'Easter Sunday' },
      { event_name: 'Eid ul-Fitr', event_type: 'FESTIVAL', event_date: '2026-03-20', year: 2026, description: 'Eid ul-Fitr' },
      { event_name: 'Mother Day', event_type: 'SPECIAL_DAY', event_date: '2026-05-10', year: 2026, description: 'Mother Day' },
      { event_name: 'Buddha Purnima', event_type: 'FESTIVAL', event_date: '2026-05-12', year: 2026, description: 'Buddha Purnima' },
      { event_name: 'Father Day', event_type: 'SPECIAL_DAY', event_date: '2026-06-21', year: 2026, description: 'Father Day' },
      { event_name: 'Eid al-Adha', event_type: 'FESTIVAL', event_date: '2026-05-27', year: 2026, description: 'Eid al-Adha' },
      { event_name: 'Independence Day', event_type: 'HOLIDAY', event_date: '2026-08-15', year: 2026, description: 'Independence Day of India' },
      { event_name: 'Raksha Bandhan', event_type: 'FESTIVAL', event_date: '2026-08-29', year: 2026, description: 'Raksha Bandhan' },
      { event_name: 'Janmashtami', event_type: 'FESTIVAL', event_date: '2026-08-05', year: 2026, description: 'Janmashtami' },
      { event_name: 'Ganesh Chaturthi', event_type: 'FESTIVAL', event_date: '2026-09-16', year: 2026, description: 'Ganesh Chaturthi' },
      { event_name: 'Onam', event_type: 'FESTIVAL', event_date: '2026-09-14', year: 2026, description: 'Onam Festival' },
      { event_name: 'Gandhi Jayanti', event_type: 'HOLIDAY', event_date: '2026-10-02', year: 2026, description: 'Gandhi Jayanti' },
      { event_name: 'Dussehra', event_type: 'FESTIVAL', event_date: '2026-10-21', year: 2026, description: 'Dussehra' },
      { event_name: 'Diwali', event_type: 'FESTIVAL', event_date: '2026-11-08', year: 2026, description: 'Diwali Festival of Lights' },
      { event_name: 'Govardhan Puja', event_type: 'FESTIVAL', event_date: '2026-11-09', year: 2026, description: 'Govardhan Puja' },
      { event_name: 'Bhai Dooj', event_type: 'FESTIVAL', event_date: '2026-11-10', year: 2026, description: 'Bhai Dooj' },
      { event_name: 'Christmas', event_type: 'HOLIDAY', event_date: '2026-12-25', year: 2026, description: 'Christmas Day' },
    ];

    let inserted = 0;
    let updated = 0;

    for (const event of events) {
      await db.execute(`
        INSERT INTO tomorrow_ai_events 
        (event_name, event_type, event_date, year, description)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
        event_type = VALUES(event_type),
        description = VALUES(description),
        updated_at = CURRENT_TIMESTAMP
      `, [
        event.event_name,
        event.event_type,
        event.event_date,
        event.year,
        event.description
      ]);

      inserted++;
    }

    console.log(`✓ Event calendar populated: ${inserted} events`);
    console.log('Events by type:');
    
    const [summary] = await db.execute(`
      SELECT event_type, COUNT(*) as count 
      FROM tomorrow_ai_events 
      GROUP BY event_type
    `);
    
    summary.forEach(row => {
      console.log(`  ${row.event_type}: ${row.count} events`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error populating events:', error);
    process.exit(1);
  }
}

populateEvents();
