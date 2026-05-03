import re
import os

files = [
    'src/best_practices_tests.rs',
    'src/locked_xlm_tests.rs',
    'src/comprehensive_tests.rs',
    'src/graduation_flow_tests.rs',
    'src/oracle_tests.rs',
    'src/tests.rs'
]

for fname in files:
    if not os.path.exists(fname):
        continue
    with open(fname, 'r') as f:
        content = f.read()

    # Replace SacFactoryClient in tuple return types: (SacFactoryClient, Address -> (SacFactoryClient<'_>, Address
    content = re.sub(r'\(SacFactoryClient(?!\<)', r'(SacFactoryClient\<\'_\>', content)

    with open(fname, 'w') as f:
        f.write(content)
    print(f'Fixed {fname}')
