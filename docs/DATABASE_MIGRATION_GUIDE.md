# Database Migration Guide: Emoji/Color to Subway Line System

## Overview

This migration transforms the anonymous user identity system from emoji/color combinations to NYC subway line identifiers. The migration is designed with zero-downtime deployment and comprehensive rollback capabilities.

## Migration Mapping

| Current (Emoji + Color) | New (Subway Line + Color) |
|------------------------|---------------------------|
| 🎭 + purple | A + mta-blue |
| 🦄 + blue | B + mta-orange |
| 🚀 + green | G + mta-light-green |
| 🌟 + orange | J + mta-brown |
| 🔥 + red | L + mta-grey |
| 💫 + purple | N + mta-yellow |
| 🎨 + blue | 1 + mta-red |
| 🌈 + green | 4 + mta-dark-green |
| ⚡ + orange | 7 + mta-purple |
| 🎪 + red | T + mta-teal |

## Migration Steps

### Prerequisites

1. **Database Backup**: Create a full database backup before starting
2. **Staging Environment**: Test the complete migration in staging first
3. **Application Code**: Prepare application code updates (don't deploy yet)
4. **Monitoring**: Set up monitoring for the migration process
5. **Team Coordination**: Ensure all team members are aware of the migration

### Step 1: Add New Columns (SAFE - Backward Compatible)

```sql
-- File: 011_add_subway_columns.sql
-- Run this migration first
```

**Expected Result**: New `subway_line` and `subway_color` columns added to `users` table

**Validation**:
```sql
-- Run validation queries from database_migration_validation.sql
-- Section: POST-STEP-1 VALIDATION
```

**Rollback**: Drop the new columns if needed (no data loss)

### Step 2: Migrate Data (SAFE - Preserves Original Data)

```sql
-- File: 012_migrate_emoji_to_subway.sql
-- Run this after Step 1 validation passes
```

**Expected Result**:
- All users have subway_line and subway_color values
- Backup table `users_emoji_backup` created
- Mapping reference table created

**Validation**:
```sql
-- Run validation queries from database_migration_validation.sql
-- Section: POST-STEP-2 VALIDATION
```

**Rollback**: Revert using `database_migration_rollback.sql` (Scenario 1)

### Step 3: Update Functions (SAFE - Maintains Compatibility)

```sql
-- File: 013_update_functions_for_subway.sql
-- Run this after Step 2 validation passes
```

**Expected Result**:
- Database functions updated to use subway fields
- Views updated to include both old and new fields
- Materialized views refreshed

**Validation**:
```sql
-- Run validation queries from database_migration_validation.sql
-- Section: POST-STEP-3 VALIDATION
```

**Rollback**: Revert using `database_migration_rollback.sql` (Scenario 1)

### Step 4: Deploy Application Changes

**At this point, deploy your application code changes to use subway fields**

- Update frontend to display subway lines instead of emojis
- Update API responses to include subway data
- Test thoroughly in production with both identity systems running

### Step 5: Drop Legacy Columns (DESTRUCTIVE - IRREVERSIBLE)

⚠️ **CRITICAL WARNING**: This step is irreversible without database backup restore!

**Prerequisites for Step 5**:
- [ ] Steps 1-3 completed and validated
- [ ] Application code deployed and tested for 24-48 hours minimum
- [ ] No application code references emoji/color fields
- [ ] Database backup created immediately before this step
- [ ] Team approval obtained
- [ ] Rollback plan tested in staging

```sql
-- File: 014_drop_legacy_columns.sql
-- UNCOMMENT the DROP COLUMN statements only when ready
-- Run this only after extensive validation
```

**Expected Result**:
- `emoji` and `color` columns permanently removed
- All functions use only subway fields
- Final backup tables created

**Validation**:
```sql
-- Run validation queries from database_migration_validation.sql
-- Section: POST-STEP-4 VALIDATION
```

**Rollback**: Only possible by restoring from database backup

## Safety Measures

### Automated Validations

Each migration script includes built-in validation:
- Pre-migration data checks
- Post-migration integrity verification
- Automatic abort on validation failures
- Detailed logging of all changes

### Backup Strategy

- **Step 2**: Creates `users_emoji_backup` table
- **Step 5**: Creates `users_identity_mapping_final` table
- **Manual**: Full database backup before each step recommended

### Rollback Procedures

#### Before Step 5 (Safe Rollback)
```sql
-- Use database_migration_rollback.sql
-- Scenario 1: Columns still exist
```

#### After Step 5 (Backup Restore Required)
```sql
-- Restore from full database backup
-- Then run validation queries to verify restoration
```

## Monitoring and Troubleshooting

### Key Metrics to Monitor

1. **User Count Consistency**: Total users should remain constant
2. **Identity Completeness**: All users should have subway data
3. **Mapping Accuracy**: Emoji/color combinations should map correctly
4. **Function Performance**: Database functions should perform normally
5. **Application Errors**: Monitor for identity-related errors

### Common Issues

#### Issue: Unmapped Emoji/Color Combinations
**Symptoms**: Migration script reports unmapped combinations
**Solution**: Review the unmapped combinations and decide:
- Add new mappings to the script
- Map to default values (A + mta-blue)
- Investigate data quality issues

#### Issue: Function Test Failures
**Symptoms**: Function validation fails in Step 3
**Solution**:
- Check function syntax and dependencies
- Verify all referenced tables/columns exist
- Review function logic for subway field usage

#### Issue: Performance Degradation
**Symptoms**: Slow queries after migration
**Solution**:
- Refresh materialized views manually
- Analyze query plans for subway field usage
- Check index utilization

### Emergency Procedures

If critical issues are discovered during migration:

1. **Stop immediately** - Don't proceed to next step
2. **Assess impact** - Run validation queries to understand scope
3. **Execute rollback** - Use appropriate rollback scenario
4. **Investigate root cause** - Review logs and validation results
5. **Fix and retry** - Address issues before attempting again

## Validation Checklist

Before each step, verify:

- [ ] Previous step validation passed completely
- [ ] No critical errors in application logs
- [ ] Database backup is recent and verified
- [ ] Team is available for support
- [ ] Rollback procedure is ready if needed

After migration completion:

- [ ] All users have valid subway identities
- [ ] Application functions correctly with new system
- [ ] Performance metrics are acceptable
- [ ] Legacy tables can be archived/dropped (after extended validation period)

## Timeline Recommendations

- **Total Duration**: 1-2 weeks for complete migration
- **Step 1-2**: Can be done immediately (backward compatible)
- **Step 3**: After 24-48 hour validation period
- **Application Deployment**: After Step 3 validation
- **Step 5**: Only after 1 week minimum of production validation

## Files Reference

| File | Purpose | Safety Level |
|------|---------|--------------|
| `011_add_subway_columns.sql` | Add new columns | SAFE |
| `012_migrate_emoji_to_subway.sql` | Convert data | SAFE |
| `013_update_functions_for_subway.sql` | Update functions | SAFE |
| `014_drop_legacy_columns.sql` | Remove old columns | DESTRUCTIVE |
| `database_migration_rollback.sql` | Rollback procedures | RECOVERY |
| `database_migration_validation.sql` | Validation queries | DIAGNOSTIC |