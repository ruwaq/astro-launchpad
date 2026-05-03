import os
import re

files = [
    'src/tests.rs',
    'src/comprehensive_tests.rs',
    'src/graduation_flow_tests.rs',
    'src/oracle_tests.rs',
    'src/locked_xlm_tests.rs',
    'src/best_practices_tests.rs'
]

for fname in files:
    if not os.path.exists(fname):
        continue
    with open(fname, 'rb') as f:
        content = f.read()
    # Use regex to match the malformed pattern
    # The file contains: SacFactoryClient\<\'_\>
    # In a bytes literal with double quotes, \" is escape but \' is just backslash+quote
    content = re.sub(
        b"SacFactoryClient\\\\\<\\\\'\\\\_\\\\'\>",
        b"SacFactoryClient<'_>",
        content
    )
    with open(fname, 'wb') as f:
        f.write(content)
    print(f'Fixed {fname}')
