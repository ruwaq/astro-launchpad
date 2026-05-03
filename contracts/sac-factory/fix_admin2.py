with open('src/lib.rs', 'r') as f:
    lines = f.readlines()

output = []
i = 0
while i < len(lines):
    line = lines[i]
    if 'admin.require_auth();' in line and '->' not in line:
        # Look ahead
        j = i + 1
        comment_lines = []
        blank_lines = []
        while j < len(lines):
            stripped = lines[j].strip()
            if stripped == '':
                blank_lines.append(lines[j])
                j += 1
            elif stripped.startswith('//'):
                comment_lines.append(lines[j])
                j += 1
            else:
                break
        if j < len(lines) and 'access_control::require_role(&env, &admin, access_control::Role::Owner)?;' in lines[j]:
            indent = len(line) - len(line.lstrip())
            spaces = line[:indent]
            # Keep comments, skip blank lines and the original require_auth line
            for c in comment_lines:
                output.append(c)
            output.append(spaces + 'admin_utils::require_owner(&env, &admin)?;\n')
            i = j + 1
            continue
    output.append(line)
    i += 1

with open('src/lib.rs', 'w') as f:
    f.writelines(output)

print('Done')
