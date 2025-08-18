#!/bin/bash

# Security Monitoring Setup Script
# This script helps set up automated security monitoring for the Spearfish AI database

set -e

echo "🛡️ Setting up Security Monitoring for Spearfish AI"
echo "=================================================="
echo ""

# Check if running on supported system
if [[ "$OSTYPE" != "linux-gnu"* ]] && [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for Linux and macOS systems"
    exit 1
fi

# Check Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    echo "   Please install Node.js and try again"
    exit 1
fi

# Check required environment variables
if [[ -z "$NEXT_PUBLIC_SUPABASE_URL" ]] || [[ -z "$SUPABASE_SERVICE_ROLE_KEY" ]]; then
    echo "❌ Required environment variables not set:"
    echo "   NEXT_PUBLIC_SUPABASE_URL"
    echo "   SUPABASE_SERVICE_ROLE_KEY"
    echo ""
    echo "   Please set these in your .env.local file and source it:"
    echo "   source .env.local"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Test the security monitoring script
echo "🧪 Testing security monitoring script..."
if node scripts/security-monitor.js; then
    echo "✅ Security monitoring script test passed"
else
    echo "❌ Security monitoring script test failed"
    echo "   Please check the script and your environment variables"
    exit 1
fi

echo ""

# Setup options
echo "🔧 Security Monitoring Setup Options:"
echo ""
echo "1. Manual monitoring (run script manually when needed)"
echo "2. Scheduled monitoring (set up cron job for automatic checks)"
echo "3. Development mode (continuous monitoring for development)"
echo ""

read -p "Select option (1-3): " option

case $option in
    1)
        echo ""
        echo "✅ Manual monitoring setup complete!"
        echo ""
        echo "📋 Usage:"
        echo "   Run security check: node scripts/security-monitor.js"
        echo "   View latest report: cat security-monitoring-report.md"
        echo ""
        ;;
    2)
        echo ""
        echo "🕐 Setting up scheduled monitoring..."
        
        # Create cron job entry
        CRON_JOB="0 */6 * * * cd $(pwd) && source .env.local && node scripts/security-monitor.js >> logs/security-monitoring.log 2>&1"
        
        # Create logs directory if it doesn't exist
        mkdir -p logs
        
        echo "📝 Proposed cron job (runs every 6 hours):"
        echo "   $CRON_JOB"
        echo ""
        
        read -p "Add this cron job? (y/n): " add_cron
        
        if [[ $add_cron == "y" ]]; then
            # Add to crontab
            (crontab -l 2>/dev/null || true; echo "$CRON_JOB") | crontab -
            echo "✅ Cron job added successfully!"
            echo ""
            echo "📋 Monitoring Schedule:"
            echo "   Runs every 6 hours"
            echo "   Logs saved to: logs/security-monitoring.log"
            echo "   Reports saved to: security-monitoring-report.md"
            echo ""
            echo "📝 Management Commands:"
            echo "   View cron jobs: crontab -l"
            echo "   Remove cron job: crontab -e (then delete the line)"
            echo "   View logs: tail -f logs/security-monitoring.log"
        else
            echo "ℹ️ Cron job not added. You can add it manually later."
        fi
        echo ""
        ;;
    3)
        echo ""
        echo "🔄 Setting up development mode..."
        echo ""
        echo "💡 Development mode runs continuous monitoring with 5-minute intervals"
        echo "   This is useful during development but not recommended for production"
        echo ""
        
        read -p "Start continuous monitoring now? (y/n): " start_continuous
        
        if [[ $start_continuous == "y" ]]; then
            echo ""
            echo "🚀 Starting continuous security monitoring..."
            echo "   Press Ctrl+C to stop"
            echo ""
            node scripts/security-monitor.js --continuous
        else
            echo "ℹ️ To start continuous monitoring later:"
            echo "   node scripts/security-monitor.js --continuous"
        fi
        echo ""
        ;;
    *)
        echo "❌ Invalid option selected"
        exit 1
        ;;
esac

# Final recommendations
echo "🎯 Security Monitoring Recommendations:"
echo ""
echo "1. 📊 Regular Review"
echo "   - Check security reports weekly"
echo "   - Investigate any failed checks immediately"
echo "   - Update monitoring thresholds as needed"
echo ""
echo "2. 🚨 Alert Setup"
echo "   - Consider integrating with your notification system"
echo "   - Set up email/Slack alerts for critical issues"
echo "   - Test alert mechanisms regularly"
echo ""
echo "3. 📝 Documentation"
echo "   - Keep security procedures documented"
echo "   - Train team members on incident response"
echo "   - Review and update security policies quarterly"
echo ""
echo "4. 🔄 Continuous Improvement"
echo "   - Add new checks as your application grows"
echo "   - Monitor for emerging security threats"
echo "   - Update monitoring scripts with new requirements"
echo ""

echo "✅ Security monitoring setup complete!"
echo ""
echo "📄 Next steps:"
echo "   - Review the generated security report"
echo "   - Set up alerting for your team"
echo "   - Add security monitoring to your incident response plan"
echo ""