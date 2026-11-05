#!/usr/bin/env python3
"""Writes LICENSE.txt and 免责声明.txt into a release folder, from the repository's LICENSE and README.

    desktop/scripts/legal_files.py FOLDER

The disclaimer is README's 「一、声明」 section, so the packages say what the site says.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    out = Path(sys.argv[1])
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    readme = (ROOT / 'README.md').read_text(encoding='utf-8')
    m = re.search(r'^### 一、声明\n(.*?)^### ', readme, re.S | re.M)
    if not m:
        raise SystemExit('README has no 「一、声明」 section')
    items = re.sub(r'\*\*(.+?)\*\*', r'\1', m.group(1)).strip()
    head = (f'方舟关系图谱 离线版 v{version}\n'
            '© 2026 Gar1ton & MKiyoaki · CC BY-NC-SA 4.0（见 LICENSE.txt）· 联系：zefeng.1.wu@kcl.ac.uk\n\n'
            '使用本程序或其数据前，请先阅读以下声明。\n\n')
    # A byte order mark, so that older Notepad versions read the Chinese correctly.
    (out / 'LICENSE.txt').write_text((ROOT / 'LICENSE').read_text(encoding='utf-8'), encoding='utf-8-sig')
    (out / '免责声明.txt').write_text(head + items + '\n', encoding='utf-8-sig')


if __name__ == '__main__':
    main()
