# 🍰 Monginis Franchise Management System

A comprehensive bakery management system built with Next.js frontend and Node.js backend, featuring inventory management, sales tracking, invoice processing, and analytics.

## 🚀 Features

### 📊 **Admin Dashboard**
- Sales analytics and insights
- Stock management with FEFO (First Expiry, First Out)
- Product and decoration management
- Expense tracking
- Returns processing (GRM/GVN)
- Invoice and credit note management

### 🛒 **Staff Functions**
- Point of Sale (POS) system
- Stock management
- Sales recording
- Returns processing
- Today's sales and stock overview

### 📄 **Document Processing**
- PDF invoice upload and parsing
- Credit note processing
- ROS receipt handling
- Automated data extraction

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Radix UI** - Component library
- **Chart.js/Recharts** - Data visualization

### Backend
- **Node.js** - Runtime
- **Express.js** - Web framework
- **MySQL** - Database
- **JWT** - Authentication
- **Multer** - File uploads
- **PDF parsing** - Document processing

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/monginis.git
   cd monginis
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Update .env with your database credentials
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Update .env.local with your API URL
   npm run dev
   ```

4. **Database Setup**
   ```bash
   cd backend
   node migrate.js
   ```

### Default Credentials
- **Admin**: `admin` / `admin123`
- **Staff**: `R3309` / `staff123`

## 🌐 Deployment

### Free Hosting Options
- **Frontend**: Vercel (unlimited personal projects)
- **Backend**: Railway (500 hours/month free)
- **Database**: Railway MySQL (included)

See `DEPLOYMENT_GUIDE.md` for detailed deployment instructions.

## 📁 Project Structure

```
monginis/
├── frontend/                 # Next.js frontend
│   ├── app/                  # App router pages
│   ├── components/           # React components
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Utilities
│   └── types/                # TypeScript types
├── backend/                  # Node.js backend
│   ├── controllers/          # Route controllers
│   ├── models/               # Database models
│   ├── routes/               # API routes
│   ├── middleware/           # Custom middleware
│   ├── utils/                # Utilities
│   └── Uploads/               # File uploads
└── DEPLOYMENT_GUIDE.md       # Deployment instructions
```

## 🔧 Environment Variables

### Backend (.env)
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=monginis_db
JWT_SECRET=your_jwt_secret
NODE_ENV=development
PORT=5000
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## 📊 Key Features

### Inventory Management
- **FEFO System**: Automatic expiry-based stock rotation
- **Batch Tracking**: Track products by invoice and expiry
- **Low Stock Alerts**: Automatic notifications
- **Stock Reports**: Comprehensive inventory analytics

### Sales Management
- **POS System**: Quick sales recording
- **Payment Tracking**: Multiple payment methods
- **Sales Analytics**: Daily, weekly, monthly reports
- **Staff Performance**: Individual sales tracking

### Document Processing
- **PDF Parsing**: Automatic invoice data extraction
- **Credit Notes**: Customer credit management
- **ROS Receipts**: Return of sale processing
- **Data Validation**: Automated error checking

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Check the deployment guide for common issues
- Review the documentation in each component

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced analytics dashboard
- [ ] Multi-location support
- [ ] API documentation
- [ ] Automated testing
- [ ] Performance optimization

---

**Built with ❤️ for Monginis Franchise Management**
