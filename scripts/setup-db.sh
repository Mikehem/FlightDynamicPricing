#!/bin/bash

# Database Setup Script for Agentic Dynamic Pricing Platform
# Run this script as a user with sudo access

set -e

# Default values (can be overridden with environment variables)
DB_NAME="${DB_NAME:-dynamic_pricing}"
DB_USER="${DB_USER:-pricing_app}"
DB_PASSWORD="${DB_PASSWORD:-changeme123}"

echo "=== Agentic Dynamic Pricing Platform - Database Setup ==="
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Installing..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    echo "PostgreSQL installed successfully."
else
    echo "PostgreSQL is already installed."
fi

# Create database and user
echo ""
echo "Creating database '$DB_NAME' and user '$DB_USER'..."

sudo -u postgres psql <<EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;

-- Connect to the database and grant schema privileges
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo ""
echo "=== Database setup complete! ==="
echo ""
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Password: $DB_PASSWORD"
echo ""
echo "Connection URL:"
echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "Add this to your .env file, then run:"
echo "  npm run db:push"
echo ""
