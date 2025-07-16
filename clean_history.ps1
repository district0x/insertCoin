# Set environment variable to suppress warning
$env:FILTER_BRANCH_SQUELCH_WARNING = "1"

# Remove all .env files and potential secret files from entire Git history
git filter-branch --force --index-filter "
    git rm --cached --ignore-unmatch \
        bot-updated/discord-bot/.env \
        onevone-functions/supabase/.env \
        funtions/supabase/.env \
        bot/discord-bot/.env \
        client/.env \
        client/.env.local \
        client/.env.production \
        *.env \
        token.txt \
        config.json \
        secrets.json \
        *.key \
        *.pem
" --prune-empty --tag-name-filter cat -- --all

# Clean up the backup refs
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive 