#!/usr/bin/env python3
#created 11/08/2026
"""Start the existing CargoPlan evidence library on the dedicated loopback port."""
import os
from pathlib import Path
import sys

base = Path(os.environ.get('CARGOPLAN_KNOWLEDGE_ROOT', Path.home() / 'Downloads' / 'CargoPlan_KnowledgeBase')).expanduser()
server = base / 'app' / 'server.py'
if not server.is_file():
    sys.exit(f'未找到本地知识库：{server}\n请设置 CARGOPLAN_KNOWLEDGE_ROOT 指向 CargoPlan_KnowledgeBase 目录。')
os.execv(sys.executable, [sys.executable, str(server), '--port', '18765'])
