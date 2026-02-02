# Mock Data Seeding

This directory contains scripts to seed the DelipuCash database with mock data via REST API calls. This ensures proper validation and business logic is applied during data creation.

## Scripts

### `seed-mock-data.mjs`
Seeds the database with comprehensive mock data by making HTTP requests to the REST API endpoints. This ensures proper validation and business logic is applied during data creation.

### `mockData.js`
JavaScript version of the mock data used by the seeding script.

## Usage

1. **Run the seeding script**:
   ```bash
   cd server
   npm run seed:mock
   ```

## Current Status

The seeding script has been configured to work with the deployed API at `https://delipucash-latest.vercel.app/api`.

### ✅ What's Working
- User authentication and registration (4 users successfully created/authenticated)
- Basic API connectivity to deployed endpoint

### ❌ Current Issues
- **Admin Authentication**: Admin credentials are `admin@delipucash.com` / `admin123456`.
- **API Validation**: Deployed API has stricter validation than expected:
  - Video creation requires different field names
  - Survey creation has database query issues (`id: undefined`)
  - Some endpoints expect different data formats
- **Data Dependencies**: Many endpoints require authenticated users, but the relationships between data entities need proper user IDs from the deployed database.

### 🔧 Next Steps
1. **Fix Admin Authentication**: Verify the correct admin password in the deployed database
2. **Update API Calls**: Adjust the seeding script to match the deployed API's expected field names and validation rules
3. **Handle Data Relationships**: Ensure proper foreign key relationships when creating dependent data

## Configuration

The script uses the following configuration:

- **API Base URL**: `https://delipucash-latest.vercel.app/api`
- **Admin Credentials**: `admin@delipucash.com` / `admin123456`
- **Default User Password**: `password123`

## Authentication

The script automatically:
- Attempts to login existing users
- Signs up new users if login fails
- Uses JWT tokens for subsequent API calls

## Error Handling

The script is designed to be resilient:
- Continues seeding even if individual items fail
- Logs warnings for failed operations
- Provides clear success/failure feedback

## Error Handling

The script is designed to be resilient:
- Continues seeding even if individual items fail
- Logs warnings for failed operations
- Provides clear success/failure feedback