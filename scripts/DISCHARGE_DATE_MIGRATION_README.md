# Discharge Date Migration Guide

This guide explains how to migrate existing patient discharge dates from the old top-level location to the correct nested location in the database.

## Background

The application was previously storing discharge dates at `patient.dischargeDate` (top level), but the database schema expects them at `patient.dischargeCriteria.dischargeDate` (nested). This migration fixes this mismatch.

## Files Created

1. **`migrate-discharge-dates.cjs`** - Main migration script
2. **`cleanup-old-discharge-dates.cjs`** - Cleanup script to remove old fields
3. **`DISCHARGE_DATE_MIGRATION_README.md`** - This file

## Prerequisites

- MongoDB connection details
- Node.js installed
- Access to the database

## Step 1: Configure Environment Variables

Set your MongoDB connection details:

```bash
export MONGODB_URI="mongodb://your-mongodb-connection-string"
export DB_NAME="your-database-name"
```

Or update the values directly in the script files.

## Step 2: Run the Migration

```bash
cd scripts
node migrate-discharge-dates.cjs
```

This script will:
- Find all patients with status "discharged"
- Move discharge dates from `patient.dischargeDate` to `patient.dischargeCriteria.dischargeDate`
- Create the `dischargeCriteria` object if it doesn't exist
- Set a discharge date for discharged patients who don't have one

## Step 3: Run the Cleanup (Optional)

After the migration is complete, you can optionally clean up the old top-level discharge dates:

```bash
node cleanup-old-discharge-dates.cjs
```

**⚠️ Warning**: Only run this AFTER confirming the migration was successful!

## What the Migration Does

### For Each Discharged Patient:

1. **Has top-level discharge date**: Moves it to `dischargeCriteria.dischargeDate`
2. **Already has correct discharge date**: Skips (no changes)
3. **No discharge date anywhere**: Sets it to `updatedAt` or `createdAt` date

### Database Changes:

**Before:**
```json
{
  "status": "discharged",
  "dischargeDate": "2024-01-15T10:00:00Z"
}
```

**After:**
```json
{
  "status": "discharged",
  "dischargeCriteria": {
    "targetSessions": 12,
    "autoDischarge": false,
    "dischargeDate": "2024-01-15T10:00:00Z"
  }
}
```

## Verification

After running the migration:

1. Check the console output for success messages
2. Verify in your application that discharged patients now show discharge dates
3. Check the database to confirm the new structure

## Rollback (If Needed)

If something goes wrong, you can restore from a database backup. The migration doesn't delete data, it only moves it.

## Troubleshooting

### Common Issues:

1. **Connection Error**: Check your MongoDB connection string
2. **Permission Error**: Ensure you have write access to the database
3. **No Patients Found**: Verify the database name and collection names

### Logs:

The scripts provide detailed logging. Look for:
- ✅ Success messages
- ⚠️ Warning messages  
- ❌ Error messages

## Support

If you encounter issues:
1. Check the console output for error details
2. Verify your MongoDB connection
3. Ensure you have the necessary permissions

## Post-Migration

After successful migration:
- ✅ All new discharges will work correctly
- ✅ Existing discharged patients will show proper discharge dates
- ✅ The "Not recorded" issue will be resolved
- ✅ All discharge-related functionality will work as expected
