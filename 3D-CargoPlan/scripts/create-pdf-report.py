#created 11/08/2026
"""Create a compact review PDF from the independently validated solution JSON.

Usage: python scripts/create-pdf-report.py [solution.json] [output.pdf]
Requires reportlab; Excel/JSON retain the full unit-by-unit coordinates.
"""
import json
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle

INPUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'delivery-output/packing-solution.json')
OUTPUT = Path(sys.argv[2] if len(sys.argv) > 2 else 'output/pdf/packing-delivery-report.pdf')
solution = json.loads(INPUT.read_text())
if not solution.get('validation', {}).get('valid'):
    raise ValueError('PDF export requires a validated solution')
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
font_file = Path('/System/Library/Fonts/STHeiti Light.ttc')
if font_file.exists():
    pdfmetrics.registerFont(TTFont('CN', str(font_file)))
else:
    pdfmetrics.registerFont(UnicodeCIDFont('STSong-Light'))
    pdfmetrics.registerFontFamily('CN', normal='STSong-Light')
    # All text drawing uses the actual registered font below.
FONT = 'CN' if font_file.exists() else 'STSong-Light'
W, H = landscape(A4)
INK = colors.HexColor('#17363d')
MUTED = colors.HexColor('#61757c')
ACCENT = colors.HexColor('#236a6b')
PALETTE = ['#5b8c91', '#8d89ad', '#bd9b58', '#6d9d81', '#8babc7', '#bd8581', '#8a9b67']
categories = sorted({p['item']['category'] for c in solution['containers'] for p in c['items']})
color_map = {name: colors.HexColor(PALETTE[i % len(PALETTE)]) for i, name in enumerate(categories)}
pdf = canvas.Canvas(str(OUTPUT), pagesize=(W, H))
pdf.setTitle('舱策 - 集装箱装载方案交付报告')
pdf.setAuthor('Container Packing AI')
style = ParagraphStyle('body', fontName=FONT, fontSize=9, leading=14, textColor=INK, alignment=TA_LEFT, wordWrap='CJK')


def line(text, x, y, size=10, color=INK):
    pdf.setFillColor(color)
    pdf.setFont(FONT, size)
    pdf.drawString(x, y, str(text))


def para(text, x, y, width, size=9):
    st = ParagraphStyle('text', parent=style, fontSize=size, leading=size * 1.5)
    p = Paragraph(escape(str(text)), st)
    _, height = p.wrap(width, H)
    p.drawOn(pdf, x, y - height)
    return y - height


def frame(page, title, subtitle):
    line('舱策 / CargoPlan', 34, H - 35, 12, ACCENT)
    line(title, 34, H - 68, 22)
    line(subtitle, 34, H - 89, 9, MUTED)
    pdf.setStrokeColor(colors.HexColor('#dce5e7'))
    pdf.line(34, 31, W - 34, 31)
    line('尺寸与坐标：mm | 重量：kg | X=长，Y=宽，Z=高', 34, 17, 8, MUTED)
    pdf.setFont(FONT, 8)
    pdf.drawRightString(W - 34, 17, f'{page} / {len(solution["containers"]) + 1}')


def table(data, x, top, widths, size=8):
    rows = [[Paragraph(escape(str(v)), ParagraphStyle('cell', parent=style, fontSize=size, leading=size * 1.35)) for v in row] for row in data]
    t = Table(rows, colWidths=widths)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#eaf2f1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7faf9')]),
        ('LINEBELOW', (0, 0), (-1, 0), .6, colors.HexColor('#c6d7d7')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6)
    ]))
    _, height = t.wrap(sum(widths), H)
    if top - height < 37:
        raise ValueError('PDF table exceeds page bounds')
    t.drawOn(pdf, x, top - height)
    return top - height


def diagram(c, x, y, max_width, max_height, vertical_axis):
    dims = c['dimensions']
    axis_size = dims['width'] if vertical_axis == 'y' else dims['height']
    scale = min(max_width / dims['length'], max_height / axis_size)
    width, height = dims['length'] * scale, axis_size * scale
    pdf.setFillColor(colors.HexColor('#f3f7f7'))
    pdf.rect(x, y, width, height, stroke=0, fill=1)
    # Transparent orthographic projection; visible projected overlap is intentional.
    for p in sorted(c['items'], key=lambda p: p['position']['z']):
        d, pos = p['actualDimensions'], p['position']
        box_height = d['width'] if vertical_axis == 'y' else d['height']
        pdf.saveState()
        pdf.setFillAlpha(.60)
        pdf.setFillColor(color_map[p['item']['category']])
        pdf.setStrokeColor(colors.HexColor('#42646b'))
        pdf.setLineWidth(.16)
        pdf.rect(x + pos['x'] * scale, y + pos[vertical_axis] * scale, d['length'] * scale, box_height * scale, fill=1, stroke=1)
        pdf.restoreState()
    pdf.setStrokeColor(INK)
    pdf.setLineWidth(.8)
    pdf.rect(x, y, width, height, fill=0, stroke=1)
    cg = c.get('centerOfGravity')
    if cg:
        pdf.setFillColor(colors.HexColor('#ed7d31'))
        pdf.circle(x + cg['x'] * scale, y + cg[vertical_axis] * scale, 3.1, fill=1, stroke=0)
    line('0', x, y - 12, 7, MUTED)
    line(f'{dims["length"]:,.0f} mm / X', x + width - 89, y - 12, 7, MUTED)
    line(f'{axis_size:,.0f} mm / {vertical_axis.upper()}', x, y + height + 5, 7, MUTED)


containers = solution['containers']
loaded = sum(len(c['items']) for c in containers)
used = sum(p['actualDimensions']['length'] * p['actualDimensions']['width'] * p['actualDimensions']['height'] for c in containers for p in c['items']) / 1e9
weight = sum(c['totalWeight'] for c in containers)
frame(1, '完整装载方案 / 交付审阅', '伊拉克 Villa 项目 | 原始三工作表全量数据 | 2026-10-16')
metrics = [('集装箱', f'{len(containers)} 柜'), ('已装载 / 未装载', f'{loaded} / {len(solution["unpackedItems"])} 件'), ('包络总体积', f'{used:.2f} m³'), ('总重量', f'{weight / 1000:.2f} t')]
for i, (label, value) in enumerate(metrics):
    x = 34 + i * 195
    pdf.setFillColor(colors.HexColor('#eef5f3'))
    pdf.roundRect(x, H - 170, 184, 59, 5, fill=1, stroke=0)
    line(label, x + 12, H - 130, 8, MUTED)
    line(value, x + 12, H - 155, 19)
line('校验通过：货物完整记账、方向、边界、无碰撞、支撑、累计承重和堆叠限制', 34, H - 195, 11, ACCENT)
y = para(f'算法 {solution["algorithm"]}，体积利用率 {solution["avgVolumeUtilization"]*100:.2f}%，计算耗时 {solution["computeTime"] / 1000:.2f} 秒。默认40HC内部尺寸12032 × 2352 × 2698 mm，最大载重28000 kg。柜数为当前可行结果，不构成全局最优证明。', 34, H - 211, W - 68)
line('结果解释与现场复核', 34, y - 25, 12)
y -= 38
for warning in solution['validation']['warnings']:
    y = para('• ' + warning, 39, y, W - 78) - 6
notes = solution.get('notes', [])
if notes:
    y = para('搜索说明：' + '；'.join(notes), 34, y - 3, W - 68) - 8
y = para('本报告提供逐柜投影视图、载重、重心及分类件数。完整1371件的精确坐标、实际占用尺寸、方向和来源行见随附Excel装柜清单与JSON方案。图中的投影重叠可能来自不同高度或宽度，不表示三维碰撞。', 34, y - 3, W - 68) - 8
table([['数据来源', '件数', '重量 kg', '包络体积 m³'], ['门窗', '1196', '60319.80', '467.299132455'], ['玻璃架', '30', '69273.51', '113.011055692'], ['辅材', '145', '5184.06', '9.802523300']], 34, y, [270, 100, 180, W - 618], 9)
pdf.showPage()

for idx, c in enumerate(containers, 1):
    d, cg = c['dimensions'], c.get('centerOfGravity', {})
    frame(idx + 1, f'集装箱 {idx:02d} / {len(containers):02d}', f'{len(c["items"])} 件 | {c["totalWeight"]:,.2f} kg / {c["maxWeight"]:,.0f} kg | 体积利用率 {c["volumeUtilization"]*100:.2f}% | 重量利用率 {c["weightUtilization"]*100:.2f}%')
    line('俯视 / X-Y', 34, H - 116, 10, ACCENT)
    diagram(c, 34, H - 289, W - 68, 148, 'y')
    line('侧视 / X-Z', 34, H - 326, 10, ACCENT)
    diagram(c, 34, H - 474, W - 68, 128, 'z')
    y = H - 503
    line(f'橙色点为重量重心：X {cg.get("x",0):,.1f} / Y {cg.get("y",0):,.1f} / Z {cg.get("z",0):,.1f} mm。', 34, y, 9)
    counts = Counter(p['item']['category'] for p in c['items'])
    for j, (name, count) in enumerate(counts.items()):
        lx, ly = 34 + (j % 5) * 153, y - 19 - (j // 5) * 14
        pdf.setFillColor(color_map[name])
        pdf.rect(lx, ly, 6, 6, fill=1, stroke=0)
        line(f'{name} {count} 件', lx + 10, ly, 8)
    pdf.showPage()

pdf.save()
print(f'{OUTPUT} ({len(containers) + 1} pages)')
