import re

with open('src/lib.rs', 'r') as f:
    content = f.read()

# Pattern 1: admin.require_auth(); followed by optional comments then require_role Owner
# We want to keep the comment but replace the auth+role with admin_utils::require_owner
pattern1 = re.compile(
    r'^(\s+)admin\.require_auth\(\);\n'
    r'((?:\1\s*//[^\n]*\n)*)'
    r'\1access_control::require_role\(&env, &admin, access_control::Role::Owner\)\?;',
    re.MULTILINE
)

def repl1(m):
    indent = m.group(1)
    comments = m.group(2)
    return comments + indent + 'admin_utils::require_owner(&env, &admin)?;\n'

content = pattern1.sub(repl1, content)

with open('src/lib.rs', 'w') as f:
    f.write(content)

print('Done')
