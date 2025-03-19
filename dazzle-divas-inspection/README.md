# Dazzle Divas Cleaning Inspection App

A modern, mobile-friendly web application for conducting cleaning inspections room by room, with photo upload capabilities.

## Features

- User authentication and role-based access
- Create and manage property inspections
- Room-by-room inspection workflow
- Task checklist verification
- Photo uploads for documentation
- Responsive design for mobile and desktop
- Persistent data storage
- Inspection history tracking

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Prisma ORM with SQLite (configurable for PostgreSQL in production)
- **Authentication**: NextAuth.js
- **File Storage**: Local file system (configurable for cloud storage in production)

## Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git

## Getting Started

Follow these steps to set up the project locally:

1. **Clone the repository**

```bash
git clone https://github.com/your-username/dazzle-divas-inspection.git
cd dazzle-divas-inspection
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Set up environment variables**

Create a `.env` file in the root directory with the following content:

```
# Database
DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"  # Generate with: openssl rand -base64 32

# File Storage (for production, use cloud storage)
UPLOAD_DIR="./uploads"
```

4. **Initialize the database**

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed the database
npx prisma db seed
```

5. **Start the development server**

```bash
npm run dev
# or
yarn dev
```

6. **Access the application**

Open your browser and navigate to `http://localhost:3000`

## Default Users

After seeding the database, you can log in with these credentials:

- **Admin**
  - Email: admin@dazzledivas.com
  - Password: admin123

- **Inspector**
  - Email: inspector@dazzledivas.com
  - Password: inspector123

## Project Structure

```
dazzle-divas-inspection/
├── prisma/                  # Database schema and migrations
├── public/                  # Static files
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── api/             # API Routes
│   │   ├── dashboard/       # Dashboard page
│   │   ├── login/           # Login page
│   │   ├── inspections/     # Inspection pages
│   │   └── ...
│   ├── components/          # Reusable components
│   ├── lib/                 # Utilities and libraries
│   ├── hooks/               # Custom React hooks
│   └── types/               # TypeScript types
└── ...
```

## Deployment

For production deployment, consider the following recommendations:

1. **Database**: Switch to PostgreSQL for better scalability and reliability
2. **File Storage**: Use a cloud storage solution like AWS S3 or Google Cloud Storage
3. **Authentication**: Add additional authentication providers as needed
4. **Hosting**: Deploy on Vercel, Netlify, or a similar platform that supports Next.js

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Acknowledgements

- Dazzle Divas Cleaning for the requirements and inspiration
- Next.js team for the amazing framework
- Tailwind CSS for the styling utilities
- Prisma team for the excellent ORM