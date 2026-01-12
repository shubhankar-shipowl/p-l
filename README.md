# Profit & Loss Dashboard

A comprehensive web application for tracking and analyzing profit & loss metrics with support for multiple data sources and marketing spend management.

## Features

- 🔐 **User Authentication**: Secure login and signup with NextAuth.js
- 📊 **Dashboard Analytics**: Real-time P&L metrics with date range filtering
- 📁 **Data Upload**: Upload CSV files for orders, price lists, and shipping costs
- 💰 **Marketing Spend Management**: Add, view, and delete marketing expenses
- 📈 **Data Visualization**: Interactive charts showing revenue trends and channel breakdowns
- 🎨 **Modern UI**: Built with Tailwind CSS and shadcn/ui components

## Tech Stack

- **Frontend**: Next.js 14+ (App Router), React, TypeScript
- **Backend**: Next.js API Routes
- **Database**: MySQL 8.0+
- **UI**: Tailwind CSS, shadcn/ui, Recharts
- **Authentication**: NextAuth.js with credentials provider
- **Libraries**: React Hook Form, Papa Parse, date-fns, bcryptjs

## Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+ installed and running
- Git (optional)

## Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd p&l-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   - Create a MySQL database
   - Run the schema file:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
   Or manually execute the SQL in `database/schema.sql`

4. **Configure environment variables**
   - Create a `.env.local` file in the root directory
   - The application supports multiple naming conventions for database variables:
   
   **Option 1: DB_* format (recommended)**
   ```env
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=profit_loss_db
   DB_PORT=3306
   ```
   
   **Option 2: DATABASE_* format**
   ```env
   DATABASE_HOST=localhost
   DATABASE_USER=root
   DATABASE_PASSWORD=your_password
   DATABASE_NAME=profit_loss_db
   DATABASE_PORT=3306
   ```
   
   **Option 3: MYSQL_* format**
   ```env
   MYSQL_HOST=localhost
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=profit_loss_db
   MYSQL_PORT=3306
   ```
   
   **Required for all options:**
   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key-here-generate-a-random-string
   PORT=3000
   NODE_ENV=development
   ```
   
   **Important**: 
   - Generate a secure random string for `NEXTAUTH_SECRET`. You can use:
     ```bash
     openssl rand -base64 32
     ```
   - The code checks variables in priority order: `DB_*` > `DATABASE_*` > `MYSQL_*` > defaults
   - See `ENV_EXAMPLE.md` for more details

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
p&l-dashboard/
├── app/
│   ├── api/              # API routes
│   │   ├── upload/       # File upload endpoints
│   │   ├── marketing-spend/  # Marketing spend CRUD
│   │   └── dashboard/    # Dashboard metrics
│   ├── upload/           # Upload page
│   ├── marketing/        # Marketing spend page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Dashboard page
│   └── globals.css       # Global styles
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── MetricsCard.tsx   # KPI card component
│   └── FileUploader.tsx  # File upload component
├── lib/
│   ├── db.ts             # Database connection
│   └── utils.ts          # Utility functions
├── database/
│   └── schema.sql        # Database schema
├── middleware.ts         # Route protection middleware
├── types/
│   └── next-auth.d.ts    # NextAuth type definitions
└── package.json
```

## CSV File Formats

### Orders CSV
```csv
channel,order_date,product_name,product_amount,shipping_price,status
Amazon,2024-01-15,Widget A,29.99,5.99,delivered
Shopify,2024-01-16,Widget B,49.99,7.99,shipped
```

### Price List CSV
```csv
product_name,cost_price,selling_price
Widget A,15.00,29.99
Widget B,25.00,49.99
```

### Shipping Costs CSV
```csv
region,weight_range,shipping_cost
US-East,0-1kg,5.99
US-West,0-1kg,7.99
```

## API Endpoints

### File Upload
- `POST /api/upload/orders` - Upload orders CSV
- `POST /api/upload/price-list` - Upload price list CSV
- `POST /api/upload/shipping-costs` - Upload shipping costs CSV

### Marketing Spend
- `GET /api/marketing-spend` - Get marketing spend (with optional start_date/end_date query params)
- `POST /api/marketing-spend` - Add marketing spend entry
- `DELETE /api/marketing-spend/:id` - Delete marketing spend entry

### Dashboard
- `GET /api/dashboard/metrics` - Get P&L metrics (requires start_date/end_date query params)

## Usage

1. **Create an Account**: Navigate to `/signup` to create a new account
2. **Login**: Use `/login` to access your account
3. **Upload Data**: Navigate to the Upload page and upload your CSV files
4. **Add Marketing Spend**: Go to the Marketing Spend page to manually add expenses
5. **View Dashboard**: The main dashboard shows real-time P&L metrics with charts
6. **Filter by Date**: Use the date range picker to analyze specific time periods

### Authentication

- All dashboard pages require authentication
- Users must sign up and login to access the application
- Passwords are securely hashed using bcrypt
- Sessions are managed using JWT tokens

## Business Logic

### Profit Calculation
- **Total Revenue**: Sum of `product_amount` for orders with status 'delivered'
- **Total Shipping Costs**: Sum of `shipping_price` for orders with status 'shipped' or 'delivered'
- **Total Marketing Spend**: Sum of `amount` from marketing_spend table
- **Net Profit**: Total Revenue - Total Shipping Costs - Total Marketing Spend
- **Profit Margin**: (Net Profit / Total Revenue) × 100

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Security Considerations

- All file uploads are validated
- SQL queries use parameterized statements to prevent injection
- Input validation on all forms
- Environment variables for sensitive data

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running: `mysql -u root -p`
- Check `.env.local` has correct credentials
- Ensure database exists: `SHOW DATABASES;`

### Upload Errors
- Verify CSV format matches expected columns
- Check file encoding (should be UTF-8)
- Ensure file size is reasonable

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`

## License

MIT

## Support

For issues or questions, please check the codebase or create an issue in your repository.

