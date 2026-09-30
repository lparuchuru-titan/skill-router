#!/usr/bin/env python3
"""Render the blog diagrams. Pillow only. Output: docs/diagrams/*.png"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent / "diagrams"
OUT.mkdir(exist_ok=True)

NAVY = (27, 58, 75)
INK = (36, 48, 56)
MUTED = (94, 106, 113)
GOLD = (140, 106, 26)
CREAM = (246, 241, 230)
WHITE = (255, 255, 255)
PAPER = (247, 245, 242)
LINE = (213, 221, 226)
GREEN = (47, 111, 78)
GREEN_BG = (232, 242, 236)
AMBER_BG = (252, 246, 232)

FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_B = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"


def font(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def wrap(draw, text, face, width):
    lines, cur = [], ""
    for word in text.split():
        trial = word if not cur else f"{cur} {word}"
        if draw.textlength(trial, font=face) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def rounded(draw, box, fill, outline, radius=18, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def arrow(draw, x1, y1, x2, y2, fill=NAVY):
    draw.line((x1, y1, x2, y2), fill=fill, width=4)
    if abs(x2 - x1) >= abs(y2 - y1):
        sign = 1 if x2 > x1 else -1
        tip = (x2, y2)
        draw.polygon([(tip[0], tip[1]), (tip[0] - 16 * sign, tip[1] - 9), (tip[0] - 16 * sign, tip[1] + 9)], fill=fill)
    else:
        sign = 1 if y2 > y1 else -1
        tip = (x2, y2)
        draw.polygon([(tip[0], tip[1]), (tip[0] - 9, tip[1] - 16 * sign), (tip[0] + 9, tip[1] - 16 * sign)], fill=fill)


def text_block(draw, box, title, body, title_fill=NAVY, body_fill=INK):
    x1, y1, x2, y2 = box
    pad = 22
    title_font = font(26, True)
    body_font = font(20)
    lines = wrap(draw, body, body_font, (x2 - x1) - pad * 2) if body else []
    title_h = 34
    line_h = 26
    block_h = title_h + (8 if lines else 0) + line_h * len(lines)
    top = y1 + ((y2 - y1) - block_h) / 2
    draw.text(((x1 + x2) / 2, top), title, font=title_font, fill=title_fill, anchor="ma")
    y = top + title_h + 8
    for line in lines:
        draw.text(((x1 + x2) / 2, y), line, font=body_font, fill=body_fill, anchor="ma")
        y += line_h


def canvas(w, h):
    image = Image.new("RGB", (w, h), PAPER)
    return image, ImageDraw.Draw(image)


def route_diagram():
    image, draw = canvas(1600, 780)
    draw.text((48, 36), "One prompt loads one skill, or none", font=font(34, True), fill=NAVY)
    draw.text((48, 84), "The rest of the library stays on disk.", font=font(22), fill=MUTED)

    prompt = (48, 180, 430, 430)
    router = (560, 180, 980, 430)
    win = (1110, 150, 1552, 360)
    quiet = (1110, 420, 1552, 630)

    rounded(draw, prompt, WHITE, NAVY)
    rounded(draw, router, CREAM, GOLD)
    rounded(draw, win, GREEN_BG, GREEN)
    rounded(draw, quiet, WHITE, LINE, width=3)

    text_block(draw, prompt, "Prompt", "Write a SOQL query for accounts created this week.")
    text_block(draw, router, "Skill router", "Score names and descriptions. Keep the hit only if it clears the floor.")
    text_block(draw, win, "Load this skill", "platform-soql-query. Read its SKILL.md and follow it.", title_fill=GREEN, body_fill=INK)
    text_block(draw, quiet, "Or abstain", "Lasagna recipes, laptop shopping. Return an empty list.", title_fill=MUTED, body_fill=MUTED)

    arrow(draw, 430, 305, 548, 305)
    arrow(draw, 980, 250, 1098, 230)
    arrow(draw, 980, 360, 1098, 500)
    draw.text((500, 250), "score", font=font(18, True), fill=GOLD)
    draw.text((1000, 175), "clears floor", font=font(18, True), fill=GREEN)
    draw.text((1000, 390), "below floor", font=font(18, True), fill=MUTED)
    image.save(OUT / "01-route.png", "PNG")


def library_diagram():
    image, draw = canvas(1600, 860)
    draw.text((48, 36), "The library is large. The turn is not.", font=font(34, True), fill=NAVY)
    draw.text((48, 84), "find_skill returns one winner. It does not paste the catalog into the prompt.", font=font(22), fill=MUTED)

    rounded(draw, (48, 160, 760, 800), WHITE, NAVY)
    draw.text((80, 184), "Skill library on disk", font=font(26, True), fill=NAVY)

    skills = [
        ("platform-soql-query", True),
        ("platform-apex-generate", False),
        ("platform-apex-test-run", False),
        ("platform-metadata-deploy", False),
        ("platform-metadata-retrieve", False),
        ("platform-custom-field-generate", False),
        ("automation-flow-generate", False),
        ("dx-code-analyzer-run", False),
    ]
    y = 240
    for name, on in skills:
        fill = GREEN_BG if on else (244, 247, 248)
        outline = GREEN if on else LINE
        rounded(draw, (80, y, 728, y + 58), fill, outline, radius=12, width=3)
        label = name + ("   ← this prompt" if on else "")
        draw.text((104, y + 29), label, font=font(22, on), fill=GREEN if on else MUTED, anchor="lm")
        y += 68

    rounded(draw, (980, 280, 1552, 620), CREAM, GOLD)
    text_block(
        draw,
        (980, 280, 1552, 620),
        "This turn",
        "Load platform-soql-query. Leave the other skills unread.",
        title_fill=GOLD,
    )
    arrow(draw, 760, 450, 968, 450)
    draw.text((800, 410), "only the winner", font=font(18, True), fill=GOLD)
    image.save(OUT / "02-library.png", "PNG")


def extend_diagram():
    image, draw = canvas(1600, 520)
    draw.text((48, 36), "A new skill is a file, then a check", font=font(34, True), fill=NAVY)
    draw.text((48, 84), "The router code does not change.", font=font(22), fill=MUTED)

    steps = [
        ("1", "Write the skill", "skills/<name>/SKILL.md. The description uses the words people type."),
        ("2", "Rebuild the index", "node scripts/generate-index.mjs"),
        ("3", "Prove the route", "Add a gold prompt. Run the eval. Fix overlaps before the next skill."),
        ("4", "Use it", "The next matching prompt loads the new skill. Nothing else was retrained."),
    ]
    x = 40
    box_w = 340
    for number, title, body in steps:
        rounded(draw, (x, 170, x + box_w, 460), WHITE, NAVY)
        circle = (x + 28, 196, x + 76, 244)
        draw.ellipse(circle, fill=NAVY)
        draw.text((x + 52, 220), number, font=font(22, True), fill=WHITE, anchor="mm")
        draw.text((x + 96, 220), title, font=font(22, True), fill=NAVY, anchor="lm")
        body_font = font(18)
        y = 270
        for line in wrap(draw, body, body_font, box_w - 48):
            draw.text((x + 24, y), line, font=body_font, fill=INK)
            y += 26
        if number != "4":
            arrow(draw, x + box_w, 315, x + box_w + 48, 315)
        x += box_w + 50
    image.save(OUT / "03-extend.png", "PNG")


if __name__ == "__main__":
    route_diagram()
    library_diagram()
    extend_diagram()
    print(OUT)
