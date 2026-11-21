"""gridiagram: hand-laid architecture diagrams on a grid, with orthogonal connectors.

Icons come from the `diagrams` package's resources (official AWS / Kubernetes /
vendor icons); layout is explicit, so every column lines up and every line is
straight. Writes SVG, and PNG when Playwright is installed.

    d = Canvas(1200, 600, "Title")
    d.group("auction-service", 200, 40, 600, 400, tone="orange")
    d.node("api", "aws/network/api-gateway.png", "REST API", 300, 200)
    d.edge("api", "fn", "invoke", route="hvh")
    d.save("out")            # out.svg (+ out.png)
"""
import base64
import html
import os

import diagrams

RES = os.path.join(os.path.dirname(diagrams.__file__), "..", "resources")

ICON = 52            # icon size (px)
LABEL_LINE = 14      # label line height
FONT = "'Inter','Helvetica Neue',Helvetica,Arial,'DejaVu Sans',sans-serif"

TONES = {            # fill, stroke, title colour
    "orange": ("#fdf6ee", "#ec9c4c", "#b35c00"),
    "blue":   ("#f1f6fe", "#5b8def", "#1f4fb8"),
    "green":  ("#f1f9f2", "#62b46c", "#1d7a2b"),
    "pink":   ("#fcf1f5", "#d4608c", "#9b1c4f"),
    "purple": ("#f6f2fd", "#9b7be0", "#5b33b5"),
    "grey":   ("#f6f7f8", "#aab2bb", "#4a535c"),
    "white":  ("#ffffff", "#c6ccd2", "#4a535c"),
}
EDGE = {             # stroke colour, dash
    "default": ("#5f6b76", None),
    "data":    ("#5f6b76", None),
    "write":   ("#c2510d", None),
    "async":   ("#5f6b76", "6 4"),
    "fail":    ("#c0144e", "6 4"),
    "control": ("#2f6fe0", "6 4"),
    "metric":  ("#8a96a3", "2 4"),
    "ok":      ("#1d7a2b", None),
}


def _icon_uri(rel):
    path = os.path.normpath(os.path.join(RES, rel))
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()


class Canvas:
    def __init__(self, width, height, title=None, subtitle=None, dy=0):
        self.w, self.h, self.dy = width, height, dy   # dy: shift the drawing (not the title) up or down
        self.title, self.subtitle = title, subtitle
        self.groups, self.nodes, self.edges, self.notes = [], {}, [], []

    # -------------------------------------------------------------- building blocks
    def group(self, title, x, y, w, h, tone="grey", dashed=False, gid=None):
        g = dict(title=title, x=x, y=y, w=w, h=h, tone=tone, dashed=dashed)
        self.groups.append(g)
        if gid:   # a group can also be an edge endpoint
            self.nodes[gid] = dict(box=(x, y, w, h))
        return g

    def node(self, nid, icon, label, cx, cy, size=ICON):
        lines = label.split("\n")
        self.nodes[nid] = dict(icon=icon, lines=lines, cx=cx, cy=cy, size=size)

    def note(self, text, x, y, anchor="start", color="#4a535c", size=12, weight="normal"):
        self.notes.append((text, x, y, anchor, color, size, weight))

    def legend(self, x, y, items):
        """items: [(kind, text)] drawn as a short sample line + text, left to right."""
        self.notes.append(("__legend__", x, y, items, None, None, None))

    def edge(self, a, b, label=None, kind="default", route="hvh", via=None, sp=0, tp=0, lpos=None,
             sides=None, mid=None):
        """route: h, v, hv, vh, hvh, vhv.  via: explicit waypoints.  sp/tp: port offsets.
        sides: (source side, target side) overrides, each one of l r t b.  mid: x (hvh) or y (vhv)
        of the middle segment.  lpos: label at this (x, y) instead of the middle of the longest leg."""
        self.edges.append(dict(a=a, b=b, label=label, kind=kind, route=route, via=via, sp=sp, tp=tp,
                               lpos=lpos, sides=sides, mid=mid))

    # -------------------------------------------------------------- geometry
    def _box(self, nid):
        n = self.nodes[nid]
        if "box" in n:
            return n["box"]
        s = n["size"]
        return (n["cx"] - s / 2, n["cy"] - s / 2, s, s)

    def _port(self, nid, side, off):
        n = self.nodes[nid]
        x, y, w, h = self._box(nid)
        bottom = y + h
        if "lines" in n and side == "b":      # below the label, not through it
            bottom = y + h + 6 + LABEL_LINE * len(n["lines"]) + 2
        cx, cy = x + w / 2, y + h / 2
        return {"l": (x - 4, cy + off), "r": (x + w + 4, cy + off),
                "t": (cx + off, y - 4), "b": (cx + off, bottom + 2)}[side]

    def _path(self, e):
        a, b = self._box(e["a"]), self._box(e["b"])
        acx, acy = a[0] + a[2] / 2, a[1] + a[3] / 2
        bcx, bcy = b[0] + b[2] / 2, b[1] + b[3] / 2
        r = e["route"]
        horiz_first = r in ("h", "hv", "hvh")
        if e["sides"]:
            s1, s2 = e["sides"]
        else:
            if horiz_first:
                s1 = "r" if bcx > acx else "l"
            else:
                s1 = "b" if bcy > acy else "t"
            last_h = r in ("h", "vh", "hvh")
            if last_h:
                s2 = "l" if bcx > acx else "r"
            else:
                s2 = "t" if bcy > acy else "b"
        p1, p2 = self._port(e["a"], s1, e["sp"]), self._port(e["b"], s2, e["tp"])
        if e["via"]:
            pts = [p1, *e["via"], p2]
        elif r == "h":
            pts = [p1, (p2[0], p1[1])]
        elif r == "v":
            pts = [p1, (p1[0], p2[1])]
        elif r == "hv":
            pts = [p1, (p2[0], p1[1]), p2]
        elif r == "vh":
            pts = [p1, (p1[0], p2[1]), p2]
        elif r == "hvh":
            mx = e["mid"] if e["mid"] is not None else (p1[0] + p2[0]) / 2
            pts = [p1, (mx, p1[1]), (mx, p2[1]), p2]
        else:  # vhv
            my = e["mid"] if e["mid"] is not None else (p1[1] + p2[1]) / 2
            pts = [p1, (p1[0], my), (p2[0], my), p2]
        # drop zero-length legs
        clean = [pts[0]]
        for p in pts[1:]:
            if abs(p[0] - clean[-1][0]) > 0.5 or abs(p[1] - clean[-1][1]) > 0.5:
                clean.append(p)
        return clean

    # -------------------------------------------------------------- rendering
    def svg(self):
        o = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
             f'viewBox="0 0 {self.w} {self.h}" font-family="{FONT}">',
             '<defs>']
        for k, (c, _) in EDGE.items():
            o.append(f'<marker id="ar-{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" '
                     f'markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>')
        o.append('</defs>')
        o.append(f'<rect width="{self.w}" height="{self.h}" fill="#ffffff"/>')
        if self.title:
            o.append(f'<text x="28" y="38" font-size="21" font-weight="700" fill="#1b2631">{html.escape(self.title)}</text>')
        if self.subtitle:
            o.append(f'<text x="28" y="60" font-size="13" fill="#5f6b76">{html.escape(self.subtitle)}</text>')

        for text, x, y, items, *_ in self.notes:
            if text != "__legend__":
                continue
            cx = x
            for kind, t in items:
                col, dash = EDGE[kind]
                da = f' stroke-dasharray="{dash}"' if dash else ""
                o.append(f'<path d="M{cx},{y - 4} L{cx + 26},{y - 4}" stroke="{col}" stroke-width="1.6"{da} '
                         f'marker-end="url(#ar-{kind})"/>')
                o.append(f'<text x="{cx + 32}" y="{y}" font-size="11.5" fill="#4a535c">{html.escape(t)}</text>')
                cx += 40 + len(t) * 6.3 + 18
        o.append(f'<g transform="translate(0,{self.dy})">')
        for g in self.groups:
            fill, stroke, tc = TONES[g["tone"]]
            dash = ' stroke-dasharray="6 4"' if g["dashed"] else ""
            o.append(f'<rect x="{g["x"]}" y="{g["y"]}" width="{g["w"]}" height="{g["h"]}" rx="12" '
                     f'fill="{fill}" stroke="{stroke}" stroke-width="1.4"{dash}/>')
            o.append(f'<text x="{g["x"] + 14}" y="{g["y"] + 22}" font-size="13" font-weight="700" '
                     f'fill="{tc}">{html.escape(g["title"])}</text>')

        labels = []
        for e in self.edges:
            pts = self._path(e)
            col, dash = EDGE[e["kind"]]
            d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
            da = f' stroke-dasharray="{dash}"' if dash else ""
            o.append(f'<path d="{d}" fill="none" stroke="{col}" stroke-width="1.6"{da} '
                     f'stroke-linejoin="round" marker-end="url(#ar-{e["kind"]})"/>')
            if e["label"]:
                if e["lpos"]:
                    lx, ly = e["lpos"]
                else:
                    legs = [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
                    (x1, y1), (x2, y2) = max(legs, key=lambda s: abs(s[1][0] - s[0][0]) + abs(s[1][1] - s[0][1]))
                    lx, ly = (x1 + x2) / 2, (y1 + y2) / 2
                labels.append((e["label"], lx, ly, col))

        for nid, n in self.nodes.items():
            if "icon" not in n or n["size"] == 0:
                continue
            s, cx, cy = n["size"], n["cx"], n["cy"]
            o.append(f'<image href="{_icon_uri(n["icon"])}" x="{cx - s / 2}" y="{cy - s / 2}" width="{s}" height="{s}"/>')
            for i, line in enumerate(n["lines"]):
                w = "600" if i == 0 else "normal"
                c = "#1b2631" if i == 0 else "#5f6b76"
                o.append(f'<text x="{cx}" y="{cy + s / 2 + 16 + i * LABEL_LINE}" font-size="{12 if i == 0 else 11}" '
                         f'font-weight="{w}" fill="{c}" text-anchor="middle">{html.escape(line)}</text>')

        for text, lx, ly, col in labels:      # edge labels last, on white tags
            lines = text.split("\n")
            tw = max(len(l) for l in lines) * 6.2 + 12
            th = 15 * len(lines) + 4
            o.append(f'<rect x="{lx - tw / 2:.1f}" y="{ly - th / 2:.1f}" width="{tw:.1f}" height="{th}" rx="4" '
                     f'fill="#ffffff" stroke="{col}" stroke-width="0.8" opacity="0.96"/>')
            for i, l in enumerate(lines):
                o.append(f'<text x="{lx:.1f}" y="{ly - th / 2 + 14 + i * 15:.1f}" font-size="11" fill="{col}" '
                         f'text-anchor="middle">{html.escape(l)}</text>')

        for text, x, y, anchor, color, size, weight in self.notes:
            if text == "__legend__":
                continue
            o.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" '
                     f'text-anchor="{anchor}">{html.escape(text)}</text>')
        o.append('</g></svg>')
        return "\n".join(o)

    def save(self, base, png=True, scale=2):
        with open(base + ".svg", "w") as f:
            f.write(self.svg())
        if png:
            try:
                from playwright.sync_api import sync_playwright
            except ImportError:
                print("playwright not installed: wrote SVG only")
                return
            with sync_playwright() as p:
                b = p.chromium.launch()
                pg = b.new_page(viewport={"width": self.w, "height": self.h}, device_scale_factor=scale)
                pg.goto("file://" + os.path.abspath(base + ".svg"))
                pg.screenshot(path=base + ".png", clip={"x": 0, "y": 0, "width": self.w, "height": self.h})
                b.close()
        print(base + (".png" if png else ".svg"))
