import os

files = [
    'src/tests.rs',
    'src/comprehensive_tests.rs',
    'src/graduation_flow_tests.rs',
    'src/oracle_tests.rs',
    'src/locked_xlm_tests.rs',
    'src/best_practices_tests.rs'
]

old = 'SacFactoryClient\\<\\'\\_\\'>'
new = "SacFactoryClient<'_>"

for fname in files:
    if not os.path.exists(fname):
        continue
    with open(fname, 'r') as f:
        content = f.read()
    if old in content:
        content = content.replace(old, new)
        with open(fname, 'w') as f:
            f.write(content)
        print(f'Fixed {fname}')
    else:
        print(f'Pattern not found in {fname}')
