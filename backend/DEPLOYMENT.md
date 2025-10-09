# Railway Deployment Configuration

## Environment Variables Required:
- `DB_HOST` - Database host (provided by Railway MySQL)
- `DB_USER` - Database username (provided by Railway MySQL)
- `DB_PASSWORD` - Database password (provided by Railway MySQL)
- `DB_NAME` - Database name (provided by Railway MySQL)
- `JWT_SECRET` - Your JWT secret key
- `NODE_ENV` - Set to "production"

## Port Configuration:
- Railway automatically provides `PORT` environment variable
- Server will use `process.env.PORT || 5000`

## Database Setup:
1. Add MySQL service in Railway
2. Railway will automatically provide database connection variables
3. Run database migrations manually or through Railway CLI

## File Uploads:
- Railway provides persistent storage in `/tmp` directory
- Consider using external storage (AWS S3, Cloudinary) for production
