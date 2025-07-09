# Mental Health Tracker CRM

A comprehensive mental health practice management system built with React, TypeScript, Node.js, and MongoDB.

## 🚀 Features

### Authentication & User Management

- **Role-based access control** (Admin, Therapist, Staff)
- **Secure login/logout** with session management
- **Password reset functionality** with default password display
- **Force password change** for new users
- **Staff invitation system** for admins

### Patient Management

- **Complete patient profiles** with personal, contact, and medical information
- **HIPAA compliance** with consent tracking
- **Patient search and filtering**
- **Bulk operations** (export, status updates)
- **Patient dashboard** with treatment history

### Appointment Scheduling

- **Flexible appointment booking** with multiple types (therapy, consultation, group, intake, follow-up)
- **Duration tracking** (15-240 minutes)
- **Status management** (scheduled, completed, cancelled, no-show)
- **Therapist assignment**
- **Today's appointments view**

### Treatment Records

- **Session documentation** with detailed notes
- **Progress tracking** and goal setting
- **Intervention logging**
- **Next session planning**
- **Treatment history timeline**

### Dashboard & Analytics

- **Real-time statistics** (patients, appointments, revenue)
- **Today's schedule** overview
- **Recent patient activity**
- **Quick action buttons**
- **Performance metrics**

### Staff Management

- **Staff directory** with role management
- **Password reset** functionality
- **Staff invitation** system
- **Audit logging** for compliance

## 🛠️ Tech Stack

### Frontend

- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **Shadcn/ui** components
- **React Query** for data fetching
- **React Hook Form** for form management

### Backend

- **Node.js** with Express
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **Session-based authentication**
- **Email service** integration (configurable)

### Development Tools

- **ESLint** and **Prettier** for code quality
- **TypeScript** for type checking
- **Hot module replacement** for development
- **Build optimization** for production

## 📦 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/Nammm-1/mentalhealthCRM.git
   cd mentalhealthCRM
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp env.template .env
   ```

   Edit `.env` with your configuration:

   ```env
   MONGODB_URI=your_mongodb_connection_string
   SESSION_SECRET=your_session_secret
   PORT=3000
   NODE_ENV=development
   ```

4. **Set up MongoDB**
   - Create a MongoDB database
   - Update the `MONGODB_URI` in your `.env` file
   - The application will automatically create collections and indexes

5. **Create admin user**

   ```bash
   node create-admin.js
   ```

6. **Start the development server**

   ```bash
   npm run dev
   ```

7. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3000/api

## 🔧 Configuration

### Environment Variables

| Variable         | Description               | Default     |
| ---------------- | ------------------------- | ----------- |
| `MONGODB_URI`    | MongoDB connection string | Required    |
| `SESSION_SECRET` | Session encryption secret | Required    |
| `PORT`           | Server port               | 3000        |
| `NODE_ENV`       | Environment mode          | development |

### Email Configuration (Optional)

To enable email functionality, add these to your `.env`:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

## 📁 Project Structure

```
MentalHealthTracker/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utility libraries
│   │   └── main.tsx       # App entry point
│   └── index.html
├── server/                 # Node.js backend
│   ├── models/            # MongoDB models
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database operations
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
├── migrations/            # Database migrations
└── package.json
```

## 🚀 Deployment

### Production Build

1. **Build the frontend**

   ```bash
   cd client
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

### Environment Setup

- Set `NODE_ENV=production`
- Configure production MongoDB URI
- Set strong session secret
- Configure email settings if needed

## 🔒 Security Features

- **Session-based authentication**
- **Role-based access control**
- **Password hashing** (ready for production)
- **CSRF protection**
- **Input validation** with Zod schemas
- **Audit logging** for compliance
- **HIPAA-compliant** data handling

## 📊 API Endpoints

### Authentication

- `POST /api/login` - User login
- `POST /api/logout` - User logout
- `POST /api/auth/change-password` - Change password

### Patients

- `GET /api/patients` - List patients
- `POST /api/patients` - Create patient
- `GET /api/patients/:id` - Get patient details
- `PATCH /api/patients/:id` - Update patient

### Appointments

- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments/:id` - Get appointment details
- `PATCH /api/appointments/:id` - Update appointment

### Staff Management

- `GET /api/staff` - List staff members
- `POST /api/staff/invite` - Invite new staff
- `POST /api/staff/:id/reset-password` - Reset password

### Dashboard

- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/today-appointments` - Today's appointments
- `GET /api/dashboard/recent-patients` - Recent patients

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation in the codebase
- Review the `FIREBASE_SETUP.md` for additional setup instructions

## 🔄 Version History

### v1.0.0 (Current)

- Complete mental health practice management system
- MongoDB integration
- Role-based authentication
- Patient and appointment management
- Treatment records
- Dashboard and analytics
- Staff management
- Password reset functionality

---

**Built with ❤️ for mental health professionals**
